/**
 * Truespace — Барный кейтеринг и финансы
 * Bank Statement & Telegram Import Modal (`src/client/components/import/StatementImportModal.tsx`)
 *
 * Provides:
 * - Step 1: Global target account selection (default bank or cash)
 * - Step 2: Upload Excel (.xlsx, .csv, 1C .txt) OR paste Telegram messages/notes
 * - Step 3: Smart preview with auto-categorization & triage indicators
 * - Step 4: 1-click batch import into cashflow journal
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  MessageSquareText,
  AlertTriangle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { ParsedStatementItem } from '../../../shared/types.js';
import { CreateTransactionDTO } from '../../../shared/dto.js';
import { useFinance } from '../../context/FinanceContext.js';
import { api } from '../../api/apiClient.js';
import { formatRubles, formatDateRu } from '../../utils/formatters.js';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const StatementImportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { accounts, categories, events, batchImportTransactions } = useFinance();

  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [targetAccountId, setTargetAccountId] = useState<string>(accounts[0]?.id || 'bank_1');
  const [textInput, setTextInput] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [parsedItems, setParsedItems] = useState<ParsedStatementItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Sync targetAccountId if accounts load asynchronously
  useEffect(() => {
    if (accounts.length > 0 && (!targetAccountId || !accounts.some((a) => a.id === targetAccountId))) {
      setTargetAccountId(accounts[0].id);
    }
  }, [accounts, targetAccountId]);

  if (!isOpen) return null;

  const resolveCategoryId = (catId?: string) => {
    if (!catId) return categories[0]?.id || '';
    if (categories.some((c) => c.id === catId)) return catId;
    if (catId === 'cat_ice') {
      const found = categories.find((c) => c.id === 'supplies' || (c.name || '').toLowerCase().includes('расходник') || (c.name || '').toLowerCase().includes('лед'));
      if (found) return found.id;
    }
    if (catId === 'cat_alcohol') {
      const found = categories.find((c) => c.id === 'alcohol' || (c.name || '').toLowerCase().includes('алког'));
      if (found) return found.id;
    }
    if (catId === 'cat_staff') {
      const found = categories.find((c) => c.id === 'staff' || (c.name || '').toLowerCase().includes('персонал'));
      if (found) return found.id;
    }
    if (catId === 'cat_logistics') {
      const found = categories.find((c) => c.id === 'logistics' || c.id === 'transport' || (c.name || '').toLowerCase().includes('логистик') || (c.name || '').toLowerCase().includes('транспорт'));
      if (found) return found.id;
    }
    if (catId === 'cat_prepayment') {
      const found = categories.find((c) => c.id === 'contract_prepayment' || (c.name || '').toLowerCase().includes('предоплат'));
      if (found) return found.id;
    }
    if (catId === 'cat_final_payment') {
      const found = categories.find((c) => c.id === 'contract_final' || (c.name || '').toLowerCase().includes('финал'));
      if (found) return found.id;
    }
    if (catId === 'cat_tips') {
      const found = categories.find((c) => c.id === 'tips' || (c.name || '').toLowerCase().includes('чаев'));
      if (found) return found.id;
    }
    if (catId === 'cat_overhead') {
      const found = categories.find((c) => c.id === 'overhead' || c.id === 'accounting');
      if (found) return found.id;
    }
    return categories[0]?.id || '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    await parseFile(file);
    e.target.value = '';
  };

  const parseFile = async (file: File) => {
    setIsParsing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const base64 = result.split(',')[1] || result;

          const res = await api.parseStatement({
            targetAccountId,
            fileName: file.name,
            fileBase64: base64,
          });

          setParsedItems(res.items.map((it) => ({ ...it, categoryId: resolveCategoryId(it.categoryId), selected: true })));
          if (res.items.length === 0) {
            setError('В файле не найдено строк с датами и суммами.');
          }
        } catch (err: any) {
          setError(err.message || 'Ошибка обработки файла');
        } finally {
          setIsParsing(false);
        }
      };
      reader.onerror = () => {
        setError('Не удалось прочитать файл');
        setIsParsing(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || 'Ошибка чтения файла');
      setIsParsing(false);
    }
  };

  const handleParseText = async () => {
    if (!textInput.trim()) {
      setError('Вставьте текст с операциями');
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      const sanitized = textInput.replace(/[\u200B-\u200D\u2060\uFEFF]/g, '');
      const res = await api.parseStatement({
        targetAccountId,
        text: sanitized,
      });

      setParsedItems(res.items.map((it) => ({ ...it, categoryId: resolveCategoryId(it.categoryId), selected: true })));
      if (res.items.length === 0) {
        setError('Не удалось распознать операции. Убедитесь, что в тексте есть суммы (например: «3500 лед»).');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка парсинга текста');
    } finally {
      setIsParsing(false);
    }
  };

  const toggleSelectItem = (id: string) => {
    setParsedItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it))
    );
  };

  const updateItemCategory = (id: string, newCategoryId: string) => {
    setParsedItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const isNowReviewed = !it.eventId ? it.needsReview : false;
          return { ...it, categoryId: newCategoryId, needsReview: isNowReviewed };
        }
        return it;
      })
    );
  };

  const updateItemEvent = (id: string, newEventId: string) => {
    const val = newEventId === 'general' ? null : newEventId;
    setParsedItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const isNowReviewed = it.categoryId === 'uncategorized';
          return { ...it, eventId: val, needsReview: isNowReviewed };
        }
        return it;
      })
    );
  };

  const handleCommitImport = async () => {
    const selected = parsedItems.filter((it) => it.selected);
    if (selected.length === 0) {
      setError('Выберите хотя бы одну операцию для импорта');
      return;
    }

    setIsImporting(true);
    setError(null);

    const dtos: CreateTransactionDTO[] = selected.map((it) => ({
      type: it.type,
      amount: it.amount,
      fromAccountId: it.type === 'expense' ? targetAccountId : null,
      toAccountId: it.type === 'income' ? targetAccountId : null,
      categoryId: it.categoryId || categories[0]?.id || 'cat_supplies',
      eventId: it.eventId || null,
      description: it.description,
      transactionDate: it.date,
      needsReview: it.needsReview,
    }));

    const res = await batchImportTransactions(dtos);
    setIsImporting(false);

    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Не удалось сохранить операции');
    }
  };

  const selectedCount = parsedItems.filter((it) => it.selected).length;
  const needsReviewCount = parsedItems.filter((it) => it.needsReview).length;

  return (
    <div className="modal-backdrop-centered" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="settings-modal-dialog"
        style={{ maxWidth: '820px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header-row">
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📥 Импорт выписки и кэшфлоу</span>
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
              Загрузите выписку из банка или вставьте список расходов из Telegram
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-modal-close"
            aria-label="Закрыть окно импорта"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="modal-validation-error" style={{ marginTop: '12px' }}>
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Target Account Selection */}
        <div style={{ marginTop: '16px', background: 'var(--muted)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <label className="modal-label" style={{ marginBottom: '6px' }}>
            1. В какой счёт заносить операции?
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              value={targetAccountId}
              onChange={(e) => setTargetAccountId(e.target.value)}
              className="modal-select"
              style={{ fontWeight: 600 }}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatRubles(a.currentBalance)})
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
              Обычно это основной р/с банка
            </span>
          </div>
        </div>

        {/* Step 2: Source Tab Switcher */}
        <div style={{ marginTop: '14px' }}>
          <div className="filter-type-tabs" style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`filter-type-pill ${activeTab === 'file' ? 'filter-type-pill-active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <FileSpreadsheet size={15} />
              <span>Файл выписки (Excel / CSV / 1C)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`filter-type-pill ${activeTab === 'text' ? 'filter-type-pill-active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <MessageSquareText size={15} />
              <span>Текст из Telegram / Заметки</span>
            </button>
          </div>

          {activeTab === 'file' ? (
            <div style={{ marginTop: '12px' }}>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                    await parseFile(file);
                  }
                }}
                onClick={() => {
                  document.getElementById('statement-file-input')?.click();
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px 16px',
                  border: `2px dashed ${isDragging ? 'var(--color-accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  background: isDragging ? 'var(--muted)' : 'var(--card)',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                }}
              >
                <UploadCloud size={32} style={{ color: isDragging ? 'var(--color-accent)' : 'var(--muted-foreground)', marginBottom: '8px' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  {selectedFile ? selectedFile.name : 'Нажмите для выбора файла или перетащите сюда'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '4px' }}>
                  Поддерживаются форматы Excel (.xlsx, .xls), CSV и выписки 1C (.txt)
                </span>
                <input
                  id="statement-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          ) : (
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea
                rows={4}
                value={textInput}
                onChange={(e) => {
                  setTextInput(e.target.value);
                  if (parsedItems.length > 0) {
                    setParsedItems([]);
                  }
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleParseText();
                  }
                }}
                placeholder={'Вставьте строки из переписки, например:\n12.09 3500 лед для Свадьбы\n14.09 +150000 предоплата\n-2400 такси на склад'}
                className="modal-input"
                style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={handleParseText}
                  disabled={isParsing || !textInput.trim()}
                  className="btn-modal-primary"
                  style={{ padding: '6px 16px', fontSize: '0.8125rem' }}
                >
                  {isParsing ? 'Распознавание...' : 'Разобрать текст'}
                </button>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
                  Ctrl + Enter для быстрого разбора
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Step 3: Preview Table */}
        {isParsing ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
            <span>Интеллектуальный разбор операций...</span>
          </div>
        ) : parsedItems.length > 0 ? (
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                  Предпросмотр ({parsedItems.length} операций)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setParsedItems([]);
                    setSelectedFile(null);
                    setError(null);
                  }}
                  className="btn-modal-secondary"
                  style={{ height: '26px', padding: '0 8px', fontSize: '0.72rem' }}
                  title="Очистить предпросмотр"
                >
                  <Trash2 size={12} />
                  <span>Очистить</span>
                </button>
              </div>
              {needsReviewCount > 0 && (
                <span style={{ fontSize: '0.75rem', color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={13} />
                  <span>{needsReviewCount} требуют выбора статьи или ивента</span>
                </span>
              )}
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ background: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 10px', width: '32px' }}>
                      <input
                        type="checkbox"
                        checked={parsedItems.every((it) => it.selected)}
                        onChange={(e) =>
                          setParsedItems((prev) => prev.map((it) => ({ ...it, selected: e.target.checked })))
                        }
                      />
                    </th>
                    <th style={{ padding: '8px 10px' }}>Дата</th>
                    <th style={{ padding: '8px 10px' }}>Сумма</th>
                    <th style={{ padding: '8px 10px' }}>Назначение</th>
                    <th style={{ padding: '8px 10px' }}>Статья</th>
                    <th style={{ padding: '8px 10px' }}>Мероприятие</th>
                    <th style={{ padding: '8px 10px' }}>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedItems.map((item) => {
                    const isExpense = item.type === 'expense';
                    const amountColor = isExpense ? '#dc2626' : '#059669';
                    const sign = isExpense ? '−' : '+';

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: item.needsReview ? '#fefce8' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '6px 10px' }}>
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => toggleSelectItem(item.id)}
                          />
                        </td>
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                          {formatDateRu(item.date)}
                        </td>
                        <td style={{ padding: '6px 10px', fontWeight: 700, color: amountColor, whiteSpace: 'nowrap' }}>
                          {sign}{formatRubles(item.amount)}
                        </td>
                        <td style={{ padding: '6px 10px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>
                          {item.description}
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <select
                            value={item.categoryId || ''}
                            onChange={(e) => updateItemCategory(item.id, e.target.value)}
                            style={{ fontSize: '0.75rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border)' }}
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <select
                            value={item.eventId || 'general'}
                            onChange={(e) => updateItemEvent(item.id, e.target.value)}
                            style={{ fontSize: '0.75rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border)' }}
                          >
                            <option value="general">Общие расходы бара</option>
                            {events.map((ev) => (
                              <option key={ev.id} value={ev.id}>{ev.title}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                          {item.needsReview ? (
                            <span style={{ color: '#d97706', fontWeight: 600 }}>⚠️ Уточнить</span>
                          ) : (
                            <span style={{ color: '#059669', fontWeight: 600 }}>✓ Готово</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                Выбрано для загрузки: <b>{selectedCount}</b> из {parsedItems.length}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-modal-secondary"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={isImporting || selectedCount === 0}
                  className="btn-modal-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isImporting ? 'Импорт...' : `Загрузить ${selectedCount} операций в кэшфлоу`}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default StatementImportModal;
