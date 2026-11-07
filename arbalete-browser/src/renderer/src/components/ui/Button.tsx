import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

// Bouton de l'interface (ARB-122, DESIGN.md « Components ») : une seule implémentation, styles dans
// design-system/controls.css. Les états Disabled, Hover, Focus et Active viennent de la feuille de style.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  icon?: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...reste }: ButtonProps) {
  return (
    <button type={type} className={cx('ui-button', `ui-button--${variant}`, size === 'sm' && 'ui-button--sm', className)} {...reste}>
      {icon}
      {children}
    </button>
  )
}
