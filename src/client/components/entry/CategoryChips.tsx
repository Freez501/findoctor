/**
 * Truespace — Барный кейтеринг и финансы
 * Category Chips Component (`src/client/components/entry/CategoryChips.tsx`)
 *
 * Provides quick-selection chips for catering categories filtered by transaction type.
 */

import React, { useState } from 'react';
import {
  Snowflake,
  Wine,
  Users,
  Truck,
  Box,
  Warehouse,
  Sparkles,
  CreditCard,
  CheckCircle2,
  FileCheck,
  BadgeCheck,
  Plus,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { TransactionType } from '../../../shared/types.js';
import { useCategories } from '../../hooks/useCategories.js';
import { useFinance } from '../../context/FinanceContext.js';
import { api } from '../../api/apiClient.js';

interface CategoryChipsProps {
  type: TransactionType;
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  isGeneralExpense?: boolean;
}

export const CategoryChips: React.FC<CategoryChipsProps> = ({
  type,
  selectedCategoryId,
  onSelectCategory,
  isGeneralExpense = false,
}) => {
  const { expenseCategories, incomeCategories } = useCategories();
  const { refreshCategories, addToast } = useFinance();
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (type === 'transfer') {
    return (
      <div className="category-transfer-fixed">
        <span className="transfer-fixed-badge">
          Статья: Внутренний перевод средств
        </span>
      </div>
    );
  }

  const list = type === 'income' ? incomeCategories : expenseCategories;

  // Filter list if general bar overhead is chosen
  const filteredList = isGeneralExpense
    ? list.filter((c) => !c.isEventSpecific || c.type === 'both')
    : list;

  // Choose appropriate Lucide icon
  const getCategoryIcon = (id: string) => {
    switch (id) {
      case 'supplies':
        return <Snowflake size={14} aria-hidden="true" />;
      case 'alcohol':
        return <Wine size={14} aria-hidden="true" />;
      case 'staff':
        return <Users size={14} aria-hidden="true" />;
      case 'logistics':
        return <Truck size={14} aria-hidden="true" />;
      case 'equipment':
        return <Box size={14} aria-hidden="true" />;
      case 'overhead':
      case 'inventory':
        return <Warehouse size={14} aria-hidden="true" />;
      case 'tips':
        return <Sparkles size={14} aria-hidden="true" />;
      case 'onsite_sales':
        return <CreditCard size={14} aria-hidden="true" />;
      case 'contract_prepayment':
        return <FileCheck size={14} aria-hidden="true" />;
      case 'contract_final':
        return <BadgeCheck size={14} aria-hidden="true" />;
      default:
        return <CheckCircle2 size={14} aria-hidden="true" />;
    }
  };

  const handleQuickCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsSaving(true);
    try {
      const res = await api.createCategory({
        name: newCategoryName.trim(),
        type,
        direction: 'operational',
        color: '#6B1D2F',
        isEventSpecific: true,
      });

      if (res.category) {
        await refreshCategories();
        onSelectCategory(res.category.id);
        addToast(`Статья «${res.category.name}» создана`, 'success');
        setNewCategoryName('');
        setIsCreating(false);
      }
    } catch (err: any) {
      addToast(err.message || 'Не удалось создать статью', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="category-chips-wrapper" role="group" aria-label="Выбор статьи операции">
      <div className="category-chips-grid">
        {filteredList.map((cat) => {
          const isSelected = selectedCategoryId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`category-chip ${isSelected ? 'category-chip-selected' : ''}`}
              style={{
                borderColor: isSelected ? cat.color : undefined,
                backgroundColor: isSelected ? `${cat.color}15` : undefined,
              }}
              title={cat.name}
            >
              <span className="category-chip-icon" style={{ color: cat.color }}>
                {getCategoryIcon(cat.id)}
              </span>
              <span className="category-chip-name">{cat.name}</span>
            </button>
          );
        })}

        {/* Inline Category Quick Add Button or Form */}
        {isCreating ? (
          <form onSubmit={handleQuickCreateCategory} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="text"
              autoFocus
              placeholder="Название..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="settings-text-input"
              style={{ padding: '4px 8px', fontSize: '0.8rem', width: '130px' }}
            />
            <button
              type="submit"
              disabled={isSaving || !newCategoryName.trim()}
              style={{ padding: '5px', backgroundColor: 'var(--color-accent)', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
              title="Создать"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewCategoryName('');
              }}
              style={{ padding: '5px', color: 'var(--color-text-muted)', cursor: 'pointer' }}
              title="Отмена"
            >
              <X size={13} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="btn-category-inline-add"
            title="Создать новую статью расходов/доходов"
          >
            <Plus size={14} />
            <span>Новая статья</span>
          </button>
        )}
      </div>
    </div>
  );
};

