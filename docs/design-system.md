# Design System — La Forge des Leaders (PRD Volume 2 v1.0)

Référence d'implémentation du Volume 2. Toute nouvelle UI doit s'y conformer.

## Tokens

### Couleurs — mode clair (défaut)
| Token | Valeur | Usage |
|---|---|---|
| `gold` | `#D4AF37` | Boutons principaux, progression, badges, premium |
| `bg` | `#FFFFFF` | Fond principal |
| `bg-soft` | `#F8F6F1` | Sections secondaires (beige) |
| `ink` | `#121212` | Texte principal |
| `line` | `#ECECEC` | Bordures, séparateurs, cartes |
| `success` | `#22C55E` | Validation, progression, succès |
| `danger` | `#EF4444` | Erreurs |
| `info` | `#2563EB` | Informations |

### Couleurs — mode sombre (palette dédiée, pas une inversion)
| Token | Valeur |
|---|---|
| fond | `#0F172A` |
| cartes | `#1E293B` |
| texte | `#F8FAFC` |
| accent | `#D4AF37` (inchangé) |

Implémentation : variables CSS sur `:root` / `.dark` + Tailwind (`darkMode: 'class'`).
Le toggle est persisté dans `localStorage('forge.theme')`, appliqué avant peinture
(script inline anti-FOUC dans le layout racine).

## Typographie
- **Inter** — police principale (corps, UI)
- **Poppins** — titres (`font-display`)
- **JetBrains Mono** — codes, identifiants techniques

## Géométrie
- Grille d'espacement : **8 px** (utiliser les pas Tailwind pairs : 2, 4, 6, 8…)
- Boutons : coins **12 px** (`rounded-xl`), ombre légère, hover animé
- Cartes : coins **20 px** (`rounded-[20px]`), ombre douce, effet de survol

## Icônes
**Lucide** (`lucide-react`) exclusivement — épaisseur uniforme, style minimaliste.

## Animations
Framer Motion uniquement : fade, slide, scale, hover — discrètes, < 200 ms.

## Composants (`apps/web/src/components/ui/`)
La bibliothèque grandit avec les besoins réels des écrans ; chaque composant est
typé, accessible (focus visible, navigation clavier), et compatible clair/sombre.
Actuels : Button, Card, Input, Badge, ProgressBar, Avatar, Skeleton.
Cible (Vol 2 §31) : Modal, Toast, Tabs, Table, Tooltip, Calendar, VideoPlayer…

## Navigation
- **Desktop/tablette** : sidebar permanente (Dashboard, Mes formations, Certificats,
  Paramètres… — les entrées Communauté/Messages/Lives apparaîtront avec leurs modules)
  + barre supérieure (recherche, notifications, profil).
- **Mobile** : navigation inférieure (Accueil, Formations, Profil — extensible),
  aucune fonctionnalité ne disparaît.

## Accessibilité & performance
WCAG 2.2 AA : contraste, clavier, focus visible, lecteurs d'écran.
Objectifs : chargement < 2 s, transitions < 200 ms, menus < 100 ms.
