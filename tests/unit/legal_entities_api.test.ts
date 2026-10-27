import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server/app.js';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { FinanceService } from '../../src/server/services/FinanceService.js';
import { LEGAL_ENTITY_IDS } from '../../src/shared/constants.js';

describe('Legal Entities REST API & Storage Suite', () => {
  let app: any;
  let store: InMemoryStore;
  let service: FinanceService;

  beforeEach(async () => {
    store = new InMemoryStore();
    await store.resetToSeed();
    service = new FinanceService(store);
    app = createApp(store, service);
  });

  it('GET /api/legal-entities returns seed legal entities (LLC, IP Catering, IP Personal, Cash)', async () => {
    const res = await request(app).get('/api/legal-entities');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.legalEntities)).toBe(true);
    expect(res.body.legalEntities.length).toBeGreaterThanOrEqual(4);

    const llc = res.body.legalEntities.find((e: any) => e.id === LEGAL_ENTITY_IDS.LLC_MAIN);
    expect(llc).toBeDefined();
    expect(llc.type).toBe('llc');
    expect(llc.taxSystem).toBe('osno');
    expect(llc.vatRate).toBe(20);
    expect(llc.taxRate).toBe(20);

    const ipCatering = res.body.legalEntities.find((e: any) => e.id === LEGAL_ENTITY_IDS.IP_CATERING);
    expect(ipCatering).toBeDefined();
    expect(ipCatering.taxSystem).toBe('usn_income_vat5');

    const cash = res.body.legalEntities.find((e: any) => e.id === LEGAL_ENTITY_IDS.CASH);
    expect(cash).toBeDefined();
    expect(cash.taxSystem).toBe('none');
  });

  it('POST /api/legal-entities creates a new legal entity with validation', async () => {
    const createRes = await request(app)
      .post('/api/legal-entities')
      .send({
        name: 'ООО «Новый Кейтеринг»',
        type: 'llc',
        taxSystem: 'usn_income_expense',
        taxRate: 15,
        vatRate: 0,
        inn: '7709998877',
        description: 'Второй бизнес',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.legalEntity).toBeDefined();
    expect(createRes.body.legalEntity.name).toBe('ООО «Новый Кейтеринг»');
    expect(createRes.body.legalEntity.taxRate).toBe(15);

    const getRes = await request(app).get(`/api/legal-entities/${createRes.body.legalEntity.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.legalEntity.inn).toBe('7709998877');
  });

  it('PUT /api/legal-entities/:id updates existing legal entity parameters', async () => {
    const updateRes = await request(app)
      .put(`/api/legal-entities/${LEGAL_ENTITY_IDS.LLC_MAIN}`)
      .send({
        name: 'ООО «Ивент Групп Эксклюзив»',
        taxRate: 25,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.legalEntity.name).toBe('ООО «Ивент Групп Эксклюзив»');
    expect(updateRes.body.legalEntity.taxRate).toBe(25);
  });

  it('DELETE /api/legal-entities/:id deactivates or removes legal entity', async () => {
    const createRes = await request(app)
      .post('/api/legal-entities')
      .send({
        name: 'ИП Временный',
        type: 'sole_proprietor',
        taxSystem: 'usn_income',
      });

    const id = createRes.body.legalEntity.id;
    const deleteRes = await request(app).delete(`/api/legal-entities/${id}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const checkRes = await request(app).get(`/api/legal-entities/${id}`);
    expect(checkRes.status).toBe(404);
  });
});
