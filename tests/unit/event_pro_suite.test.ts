/**
 * Truespace — Event Pro Suite Backend & Logic Tests (`tests/unit/event_pro_suite.test.ts`)
 *
 * Verifies:
 * 1. Storage & In-Memory CRUD for Payment Milestones, Event Budget Items, Vendors
 * 2. Automatic vendor remaining amount reduction on expense creation & restoration on soft-delete
 * 3. Cash Flow Forecast & Shortage Radar calculations
 * 4. REST API endpoints (/api/events/:id/milestones, /api/events/:id/budget, /api/events/:id/vendors, /api/analytics/cashflow-calendar)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { AnalyticsService } from '../../src/server/services/AnalyticsService.js';
import { createApp } from '../../src/server/app.js';
import { EVENT_IDS, CATEGORY_IDS, ACCOUNT_IDS } from '../../src/shared/constants.js';

describe('Event Pro Suite — Backend Core & Storage Tests', () => {
  let store: InMemoryStore;
  let analyticsService: AnalyticsService;
  let app: any;

  beforeEach(() => {
    store = new InMemoryStore();
    analyticsService = new AnalyticsService(store);
    app = createApp(store);
  });

  describe('1. Event Payment Milestones (График оплат от заказчика)', () => {
    it('returns seeded milestones for wedding event', async () => {
      const milestones = await store.getMilestones(undefined, EVENT_IDS.WEDDING);
      expect(milestones.length).toBeGreaterThanOrEqual(2);
      expect(milestones[0].amount).toBe(130000);
      expect(milestones[0].status).toBe('received');
    });

    it('creates, updates and deletes a payment milestone', async () => {
      const created = await store.saveMilestone({
        eventId: EVENT_IDS.WEDDING,
        title: 'Тестовый транш 20%',
        dueDate: '2026-10-01',
        amount: 50000,
        status: 'pending',
      });
      expect(created.id).toBeDefined();
      expect(created.amount).toBe(50000);

      // Verify in list
      const list = await store.getMilestones(undefined, EVENT_IDS.WEDDING);
      expect(list.some((m) => m.id === created.id)).toBe(true);

      // Update milestone
      const updated = await store.saveMilestone({
        id: created.id,
        eventId: EVENT_IDS.WEDDING,
        title: 'Обновленный транш',
        dueDate: '2026-10-02',
        amount: 55000,
        status: 'received',
        paidAmount: 55000,
      });
      expect(updated.amount).toBe(55000);
      expect(updated.status).toBe('received');

      // Delete milestone
      const deleted = await store.deleteMilestone(created.id);
      expect(deleted).toBe(true);

      const afterDelete = await store.getMilestones(undefined, EVENT_IDS.WEDDING);
      expect(afterDelete.some((m) => m.id === created.id)).toBe(false);
    });
  });

  describe('2. Event Budget Items (Смета: План vs Факт)', () => {
    it('returns seeded budget items for wedding event', async () => {
      const budget = await store.getBudgetItems(undefined, EVENT_IDS.WEDDING);
      expect(budget.length).toBeGreaterThanOrEqual(4);
      const alcoholBudget = budget.find((b) => b.categoryId === CATEGORY_IDS.ALCOHOL);
      expect(alcoholBudget?.plannedAmount).toBe(50000);
    });

    it('sets and updates planned budget item for category', async () => {
      const item = await store.saveBudgetItem({
        eventId: EVENT_IDS.WEDDING,
        categoryId: CATEGORY_IDS.EQUIPMENT,
        plannedAmount: 35000,
        notes: 'Аренда барной стойки и стекла',
      });
      expect(item.plannedAmount).toBe(35000);

      // Updating same category updates the row rather than duplicating
      const updated = await store.saveBudgetItem({
        eventId: EVENT_IDS.WEDDING,
        categoryId: CATEGORY_IDS.EQUIPMENT,
        plannedAmount: 40000,
      });
      expect(updated.plannedAmount).toBe(40000);

      const list = await store.getBudgetItems(undefined, EVENT_IDS.WEDDING);
      const equipItems = list.filter((b) => b.categoryId === CATEGORY_IDS.EQUIPMENT);
      expect(equipItems.length).toBe(1);
    });
  });

  describe('3. Event Vendors & Crew (Подрядчики и остатки выплат)', () => {
    it('returns seeded vendors for wedding and corporate', async () => {
      const vendors = await store.getVendors(undefined, EVENT_IDS.WEDDING);
      expect(vendors.length).toBeGreaterThanOrEqual(2);
      const dj = vendors.find((v) => v.name.includes('DJ'));
      expect(dj?.agreedFee).toBe(35000);
      expect(dj?.remainingAmount).toBe(35000);
      expect(dj?.status).toBe('pending');
    });

    it('automatically reduces vendor remainingAmount when an expense is linked to vendor', async () => {
      const vendor = await store.saveVendor({
        eventId: EVENT_IDS.WEDDING,
        name: 'Декоратор Светлана',
        role: 'Декоратор',
        agreedFee: 60000,
        paidAmount: 0,
        remainingAmount: 60000,
        status: 'pending',
      });

      expect(vendor.remainingAmount).toBe(60000);

      // Create an advance payment transaction of 25 000 ₽ tied to this vendor
      const tx = await store.createTransaction({
        type: 'expense',
        amount: 25000,
        fromAccountId: ACCOUNT_IDS.CASH_1,
        categoryId: CATEGORY_IDS.STAFF,
        eventId: EVENT_IDS.WEDDING,
        vendorId: vendor.id,
        vendorName: vendor.name,
        description: 'Аванс декоратору Светлане',
      });

      const updatedVendor = await store.getVendorById(vendor.id);
      expect(updatedVendor?.paidAmount).toBe(25000);
      expect(updatedVendor?.remainingAmount).toBe(35000);
      expect(updatedVendor?.status).toBe('partial');

      // Soft-delete transaction -> vendor debt is restored!
      await store.softDeleteTransaction(tx.id);
      const restoredVendor = await store.getVendorById(vendor.id);
      expect(restoredVendor?.paidAmount).toBe(0);
      expect(restoredVendor?.remainingAmount).toBe(60000);
      expect(restoredVendor?.status).toBe('pending');
    });
  });

  describe('4. Cash Flow Forecast & Shortage Radar (Платёжный календарь)', () => {
    it('calculates 30-day cashflow forecast with running balance', async () => {
      const forecast = await analyticsService.getCashFlowForecast(undefined, 15);
      expect(forecast.startDate).toBeDefined();
      expect(forecast.endDate).toBeDefined();
      expect(forecast.days.length).toBe(15);
      expect(forecast.currentCapital).toBeGreaterThan(0);

      // Verify each day continues the previous day's closing balance
      for (let i = 1; i < forecast.days.length; i++) {
        expect(forecast.days[i].openingBalance).toBe(forecast.days[i - 1].closingBalance);
      }
    });

    it('detects a cash shortage when planned vendor expenses exceed capital', async () => {
      // Drain accounts or create a massive vendor debt due today
      await store.saveVendor({
        eventId: EVENT_IDS.WEDDING,
        name: 'VIP Оркестр',
        role: 'Музыканты',
        agreedFee: 5000000, // 5 million rubles
        paidAmount: 0,
        remainingAmount: 5000000,
        status: 'pending',
        dueDate: new Date().toISOString().split('T')[0], // Due today!
      });

      const forecast = await analyticsService.getCashFlowForecast(undefined, 7);
      expect(forecast.hasShortages).toBe(true);
      expect(forecast.maxShortageAmount).toBeGreaterThan(0);
      expect(forecast.days[0].isShortage).toBe(true);
    });
  });

  describe('5. REST API Endpoints', () => {
    it('GET & POST /api/events/:id/milestones', async () => {
      const resList = await request(app).get(`/api/events/${EVENT_IDS.WEDDING}/milestones`);
      expect(resList.status).toBe(200);
      expect(Array.isArray(resList.body.milestones)).toBe(true);

      const resCreate = await request(app)
        .post(`/api/events/${EVENT_IDS.WEDDING}/milestones`)
        .send({
          title: 'Тестовый платеж по договору',
          dueDate: '2026-10-15',
          amount: 45000,
          status: 'pending',
        });
      expect(resCreate.status).toBe(201);
      expect(resCreate.body.milestone.title).toBe('Тестовый платеж по договору');
    });

    it('GET & POST /api/events/:id/budget', async () => {
      const resCreate = await request(app)
        .post(`/api/events/${EVENT_IDS.WEDDING}/budget`)
        .send({
          categoryId: CATEGORY_IDS.LOGISTICS,
          plannedAmount: 18000,
          notes: 'Грузовое такси и портовые тележки',
        });
      expect(resCreate.status).toBe(201);
      expect(resCreate.body.budgetItem.plannedAmount).toBe(18000);

      const resList = await request(app).get(`/api/events/${EVENT_IDS.WEDDING}/budget`);
      expect(resList.status).toBe(200);
      expect(resList.body.budgetItems.some((b: any) => b.categoryId === CATEGORY_IDS.LOGISTICS)).toBe(true);
    });

    it('GET & POST /api/events/:id/vendors', async () => {
      const resCreate = await request(app)
        .post(`/api/events/${EVENT_IDS.WEDDING}/vendors`)
        .send({
          name: 'Ведущий Артём',
          role: 'Ведущий',
          agreedFee: 50000,
          paidAmount: 20000,
          phone: '+7 (999) 777-88-99',
        });
      expect(resCreate.status).toBe(201);
      expect(resCreate.body.vendor.remainingAmount).toBe(30000);
      expect(resCreate.body.vendor.status).toBe('partial');
    });

    it('GET /api/analytics/cashflow-calendar', async () => {
      const res = await request(app).get('/api/analytics/cashflow-calendar?daysAhead=14');
      expect(res.status).toBe(200);
      expect(res.body.days.length).toBe(14);
      expect(res.body.currentCapital).toBeDefined();
    });
  });
});
