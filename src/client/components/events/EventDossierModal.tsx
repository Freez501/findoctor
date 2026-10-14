import React, { useState, useEffect } from 'react';
import { X, Calendar, User, MapPin, PieChart, Users, Receipt } from 'lucide-react';
import { CateringEvent } from '../../../shared/types.js';
import { useFinance } from '../../context/FinanceContext.js';
import { formatRubles, formatDateRu } from '../../utils/formatters.js';
import { EventBudgetTab } from './EventBudgetTab.js';
import { EventContractorsTab } from './EventContractorsTab.js';
import { EventMilestonesTab } from './EventMilestonesTab.js';

interface EventDossierModalProps {
  event: CateringEvent;
  isOpen: boolean;
  onClose: () => void;
}

type DossierTab = 'budget' | 'contractors' | 'milestones';

export const EventDossierModal: React.FC<EventDossierModalProps> = ({ event, isOpen, onClose }) => {
  const { transactions } = useFinance();
  const [activeTab, setActiveTab] = useState<DossierTab>('budget');

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Compute live event transactions summary
  let totalIncome = 0;
  let totalExpense = 0;
  transactions.forEach((tx) => {
    if (tx.eventId === event.id) {
      if (tx.type === 'income') totalIncome += tx.amount;
      if (tx.type === 'expense') totalExpense += tx.amount;
    }
  });

  const contractAmount = event.contractAmount || totalIncome;
  const clientDebt = Math.max(0, contractAmount - totalIncome);
  const currentMargin = totalIncome - totalExpense;

  return (
    <div className="dossier-modal-backdrop" onClick={onClose}>
      <div
        className="dossier-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-modal-title"
      >
        {/* Modal Top Header */}
        <div className="dossier-modal-header">
          <div className="dossier-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span className="dossier-label-badge">Финансовое досье</span>
              <h2 id="dossier-modal-title" className="dossier-modal-title">
                {event.title}
              </h2>
            </div>

            <div className="dossier-meta-row">
              {event.clientName && (
                <span className="dossier-meta-item">
                  <User size={13} /> {event.clientName}
                </span>
              )}
              <span className="dossier-meta-item">
                <Calendar size={13} /> {formatDateRu(event.eventDate)}
              </span>
              {event.location && (
                <span className="dossier-meta-item">
                  <MapPin size={13} /> {event.location}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="dossier-close-button"
            title="Закрыть досье"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Project Overview Strip */}
        <div className="dossier-quick-strip">
          <div className="dossier-strip-item">
            <span className="strip-label">Договор</span>
            <span className="strip-val">{formatRubles(contractAmount)}</span>
          </div>
          <div className="dossier-strip-item">
            <span className="strip-label">Поступило</span>
            <span className="strip-val val-green">{formatRubles(totalIncome)}</span>
          </div>
          <div className="dossier-strip-item">
            <span className="strip-label">Дебиторка</span>
            <span className={`strip-val ${clientDebt > 0 ? 'val-amber' : ''}`}>
              {formatRubles(clientDebt)}
            </span>
          </div>
          <div className="dossier-strip-item">
            <span className="strip-label">Расходы проекта</span>
            <span className="strip-val val-red">{formatRubles(totalExpense)}</span>
          </div>
          <div className="dossier-strip-item">
            <span className="strip-label">Текущая прибыль</span>
            <span className={`strip-val ${currentMargin >= 0 ? 'val-green' : 'val-red'}`}>
              {formatRubles(currentMargin)}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="dossier-tabs-nav">
          <button
            type="button"
            onClick={() => setActiveTab('budget')}
            className={`dossier-tab-btn ${activeTab === 'budget' ? 'tab-active' : ''}`}
          >
            <PieChart size={16} />
            <span>Смета План-Факт</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('contractors')}
            className={`dossier-tab-btn ${activeTab === 'contractors' ? 'tab-active' : ''}`}
          >
            <Users size={16} />
            <span>Подрядчики и команда</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('milestones')}
            className={`dossier-tab-btn ${activeTab === 'milestones' ? 'tab-active' : ''}`}
          >
            <Receipt size={16} />
            <span>График оплат от клиента</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="dossier-tab-body">
          {activeTab === 'budget' && <EventBudgetTab event={event} />}
          {activeTab === 'contractors' && <EventContractorsTab event={event} />}
          {activeTab === 'milestones' && <EventMilestonesTab event={event} />}
        </div>
      </div>
    </div>
  );
};
