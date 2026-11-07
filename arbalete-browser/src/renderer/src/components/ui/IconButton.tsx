import type { ReactNode } from 'react'
import { Button, type ButtonProps } from './Button'

// Bouton réduit à une icône : `title` est obligatoire, il sert d'infobulle et de nom accessible (DESIGN.md,
// Iconography : une icône seule non explicite a une infobulle).
// shortcut: infobulle native du navigateur (attribut title) ; ARB-126 la remplacera par le composant Tooltip.
type IconButtonProps = Omit<ButtonProps, 'icon' | 'children' | 'title'> & { title: string; children: ReactNode }

export function IconButton({ title, children, className, variant = 'ghost', ...reste }: IconButtonProps) {
  return (
    <Button variant={variant} title={title} aria-label={title} className={`ui-button--icon${className ? ` ${className}` : ''}`} {...reste}>
      {children}
    </Button>
  )
}
