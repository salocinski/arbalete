export const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(' ')
