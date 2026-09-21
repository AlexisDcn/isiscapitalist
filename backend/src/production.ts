// Calcule combien de productions complètes d'un produit ont pu se dérouler
// pendant `elapseTime` (en ms), en repartant du temps restant sur le cycle en
// cours (`product.timeleft`). Met à jour `product.timeleft` en place et
// retourne la quantité produite.
//
// Sans manager, une seule production peut se terminer entre deux mises à
// jour (le joueur doit relancer manuellement la suivante) : si le temps
// restant est dépassé, on gagne 1 exemplaire et le temps restant retombe à 0,
// sans tenir compte du temps en trop.
//
// Avec un manager, la production s'enchaîne automatiquement : après avoir
// terminé le cycle en cours, le temps restant est consommé en cycles complets
// supplémentaires (vitesse), le reste étant reporté sur le prochain cycle.
export function calcQtProductionforElapseTime(
  product: { vitesse: number; timeleft: number; managerUnlocked: boolean },
  elapseTime: number,
): number {
  if (product.timeleft === 0) {
    return 0;
  }

  if (elapseTime < product.timeleft) {
    product.timeleft -= elapseTime;
    return 0;
  }

  if (!product.managerUnlocked) {
    product.timeleft = 0;
    return 1;
  }

  const tempsRestant = elapseTime - product.timeleft;
  const cyclesSupplementaires = Math.floor(tempsRestant / product.vitesse);
  const reste = tempsRestant - cyclesSupplementaires * product.vitesse;
  product.timeleft = product.vitesse - reste;
  return 1 + cyclesSupplementaires;
}
