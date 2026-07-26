# Proposal: Tabs Redesign (Stitch → React)

## Why
App.jsx es un monolito de 1515 líneas. Los diseños de Stitch tienen layout profesional (sidebar 240px, header 72px, Material Symbols). Hay que dividir en componentes y aplicar design system Obsidian Deep.

## Scope
- 3 componentes layout: Sidebar, Header, MobileNav
- 5 vistas: Dashboard, Chat, Cerebro, Grafo, Ajustes
- app.css con todo el CSS de la app (layout + tabs)
- Refactor App.jsx a thin orquestador
- Eliminar styles.css viejo
- Rebuild Docker frontend

## No incluido
- Backend
- SetupWizard (ya hecho)
- tokens.css (ya existe)

## Approach
- Sin Tailwind. CSS plano con var(--color-*).
- State en App.jsx → props down. Sin context.
- Material Symbols en vez de emojis.
- Lógica existente migrada sin cambios funcionales.

## Rollback
Revert frontend/src/. Sin cambios en backend ni Docker.