/**
 * Truespace — Барный кейтеринг и финансы
 * Common Badge Component (`src/client/components/common/Badge.tsx`)
 *
 * Semantic, accessible badge pill for transaction types, account types,
 * categories, and status tags.
 */

import React from 'react';
import { AccountType, TransactionType } from '../../../shared/types.js';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'default' | 'expense' | 'income' | 'transfer' | 'cash' | 'bank' | 'card' | 'info' | 'success';
  size?: 'sm' | 'md';
  color?: string;
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  color,
  icon,
  className = '',
  style,
}) => {
  const sizeClasses = size === 'sm' ? 'badge-sm' : 'badge-md';

  let variantClass = 'badge-default';
  if (variant === 'expense') variantClass = 'badge-expense';
  if (variant === 'income') variantClass = 'badge-income';
  if (variant === 'transfer') variantClass = 'badge-transfer';
  if (variant === 'cash') variantClass = 'badge-cash';
  if (variant === 'bank') variantClass = 'badge-bank';
  if (variant === 'card') variantClass = 'badge-card';
  if (variant === 'info') variantClass = 'badge-info';
  if (variant === 'success') variantClass = 'badge-success';

  const customStyle: React.CSSProperties = color
    ? {
        backgroundColor: `${color}18`,
        color: color,
        borderColor: `${color}40`,
      }
    : {};

  return (
    <span
      className={`badge ${variantClass} ${sizeClasses} ${className}`}
      style={{ ...customStyle, ...style }}
    >
      {icon && <span className="badge-icon" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export function getAccountTypeLabel(type: AccountType): string {
  switch (type) {
    case 'cash':
      return 'Наличные';
    case 'bank':
      return 'Расчётный счёт';
    case 'card':
      return 'СБП / Переводы';
    default:
      return type;
  }
}

export function getTransactionTypeLabel(type: TransactionType): string {
  switch (type) {
    case 'expense':
      return 'Расход';
    case 'income':
      return 'Доход';
    case 'transfer':
      return 'Перевод';
    default:
      return type;
  }
}
