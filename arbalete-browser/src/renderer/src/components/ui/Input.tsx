import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { cx } from './cx'

// Champ de saisie (ARB-122) : surface neutre, bordure discrète, focus identifiable sur tout le champ, erreur
// explicite sous le champ. `leading` et `trailing` accueillent une icône ou un bouton dans le champ.
type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  ref?: Ref<HTMLInputElement>
  leading?: ReactNode
  trailing?: ReactNode
  error?: string
  fieldClassName?: string
}

export function Input({ ref, leading, trailing, error, className, fieldClassName, ...reste }: InputProps) {
  const erreurId = useId()
  return (
    <div className={cx('ui-field-group', className)}>
      <div className={cx('ui-field', error && 'ui-field--error', fieldClassName)}>
        {leading}
        <input ref={ref} className="ui-input" aria-invalid={error ? true : undefined} aria-describedby={error ? erreurId : undefined} {...reste} />
        {trailing}
      </div>
      {error && <p id={erreurId} className="ui-field-error" role="alert">{error}</p>}
    </div>
  )
}
