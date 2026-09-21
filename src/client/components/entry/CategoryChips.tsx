/**
 * Truespace — Барный кейтеринг и финансы
 * Category Chips Component (`src/client/components/entry/CategoryChips.tsx`)
 *
 * Provides quick-selection chips for catering categories filtered by transaction type.
 */

import React from 'react';
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
} from 'lucide-react';
import { TransactionType } from '../../../shared/types.js';
import { useCategories } from '../../hooks/useCategories.js';

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
      </div>
    </div>
  );
};
