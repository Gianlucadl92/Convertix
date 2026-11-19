import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'converti-file',
  },
  {
    path: 'converti-file',
    title: 'Convertix - Converti file',
    loadComponent: () =>
      import('./converti-file/converti-file').then((component) => component.ConvertiFile),
  },
  {
    path: 'riduci-peso-immagine',
    title: 'Convertix - Riduci peso immagine',
    loadComponent: () =>
      import('./riduci-peso-immagine/riduci-peso-immagine').then(
        (component) => component.RiduciPesoImmagine,
      ),
  },
  {
    path: '**',
    pathMatch: 'full',
    redirectTo: 'converti-file',
  },
];
