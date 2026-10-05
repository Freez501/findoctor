/**
 * Truespace — Inline Category Creation & Company Attribution Unit Tests
 * `tests/unit/inline_category_creation.test.ts`
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { createCategoriesRouter } from '../../src/server/routes/categories.js';
import express from 'express';
import request from 'supertest';

describe('Categories Multi-Tenancy & Quick Creation API', () => {
  let store: InMemoryStore;
  let app: express.Express;

  beforeEach(() => {
    store = new InMemoryStore();
    app = express();
    app.use(express.json());
    app.use('/api/categories', createCategoriesRouter(store));
  });

  it('creates an income category with company attribution from headers or body', async () => {
    const testCompanyId = 'comp_bar_custom_999';

    const res = await request(app)
      .post('/api/categories')
      .set('x-company-id', testCompanyId)
      .send({
        name: 'Другое',
        type: 'income',
        direction: 'operational',
      });

    expect(res.status).toBe(201);
    expect(res.body.category).toBeDefined();
    expect(res.body.category.name).toBe('Другое');
    expect(res.body.category.type).toBe('income');
    expect(res.body.category.companyId).toBe(testCompanyId);
    expect(res.body.category.color).toBe('#10b981'); // Emerald green for income

    // Now query categories for this company
    const getRes = await request(app)
      .get('/api/categories')
      .set('x-company-id', testCompanyId);

    expect(getRes.status).toBe(200);
    const names = getRes.body.categories.map((c: any) => c.name);
    expect(names).toContain('Другое');

    // Default system categories are also accessible
    expect(names).toContain('Предоплата по договору');
  });

  it('creates an expense category and preserves companyId', async () => {
    const testCompanyId = 'comp_bar_custom_888';

    const res = await request(app)
      .post('/api/categories')
      .send({
        companyId: testCompanyId,
        name: 'Фрукты и ягоды',
        type: 'expense',
      });

    expect(res.status).toBe(201);
    expect(res.body.category.companyId).toBe(testCompanyId);

    const getRes = await request(app)
      .get('/api/categories')
      .set('x-company-id', testCompanyId);

    const names = getRes.body.categories.map((c: any) => c.name);
    expect(names).toContain('Фрукты и ягоды');
  });

  it('updates an existing category while preserving its companyId', async () => {
    const testCompanyId = 'comp_bar_custom_777';

    const createRes = await request(app)
      .post('/api/categories')
      .set('x-company-id', testCompanyId)
      .send({
        name: 'Старая статья',
        type: 'income',
      });

    const catId = createRes.body.category.id;

    const updateRes = await request(app)
      .put(`/api/categories/${catId}`)
      .set('x-company-id', testCompanyId)
      .send({
        name: 'Обновлённая статья',
        type: 'income',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.category.name).toBe('Обновлённая статья');
    expect(updateRes.body.category.companyId).toBe(testCompanyId);
  });
});
