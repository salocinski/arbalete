// Menu contextuel des onglets (ARB-41) : les actions possibles sont une liste fermée, validée par le processus principal.
export const ACTIONS_ONGLET = ['dupliquer', 'epingler', 'fermer-autres', 'copier-adresse'] as const
export type ActionOnglet = (typeof ACTIONS_ONGLET)[number]

export const estActionOnglet = (valeur: unknown): valeur is ActionOnglet =>
  typeof valeur === 'string' && (ACTIONS_ONGLET as readonly string[]).includes(valeur)

// « Fermer les autres » : tous les onglets de l'espace sauf celui du menu et les onglets épinglés.
export const ongletsAFermer = (onglets: { id: string; pinned?: boolean }[], garde: string): string[] =>
  onglets.filter((onglet) => onglet.id !== garde && !onglet.pinned).map((onglet) => onglet.id)
