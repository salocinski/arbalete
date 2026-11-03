// Écriture différée (ARB-44) : des demandes rapprochées ne donnent qu'une écriture, delaiMs après la dernière. Une suite
// de demandes sans pause (titre qui défile, page qui se recharge en boucle) n'écrit pas moins d'une fois toutes les
// attenteMaxMs. vider() écrit tout de suite ce qui attend : à la fermeture, rien n'est perdu.
export type EcritureDifferee = {
  demander: () => void
  vider: () => void
}

export function creerEcritureDifferee(ecrire: () => void, delaiMs: number, attenteMaxMs: number): EcritureDifferee {
  let minuterie: ReturnType<typeof setTimeout> | undefined
  // Instant de la première demande encore en attente.
  let debut: number | undefined

  function executer() {
    clearTimeout(minuterie)
    minuterie = undefined
    debut = undefined
    ecrire()
  }

  return {
    demander() {
      const maintenant = Date.now()
      debut ??= maintenant
      clearTimeout(minuterie)
      minuterie = setTimeout(executer, Math.max(0, Math.min(delaiMs, debut + attenteMaxMs - maintenant)))
    },
    vider() {
      if (minuterie !== undefined) executer()
    }
  }
}
