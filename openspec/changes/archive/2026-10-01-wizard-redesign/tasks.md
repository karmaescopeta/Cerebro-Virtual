1|# Tasks — wizard-redesign
2|
3|## 1. Copy + base
4|- [x] 1.1 WelcomeScreen: versión de /api/version (fallback: ocultar), botón "Empezar", copy welcome
5|- [x] 1.2 wizard.css: eliminar @import Material Symbols Outlined; auditar iconos del wizard contra lista verificada Rounded
6|- [x] 1.3 WizardStep1: copy humano completo (títulos, labels, hints, errores) + link OpenRouter en el hint de API key
7|- [x] 1.4 WizardStepModels: copy llano local/nube/ambas coherente con PRIVADO/NUBE
8|- [x] 1.5 WizardStep2 + WizardStep3: copy confirmación legible + log pulido (iconos estado)
9|
10|## 2. Preview + avatar
11|- [x] 2.1 WizardStep1: tarjeta preview en vivo (avatar/por defecto + "Hola, soy X" + directiva truncada)
12|- [x] 2.2 Avatar picker en wizard (patrón AjustesView: file hidden → FileReader → validación) + formData.avatar
13|- [x] 2.3 SetupWizard.handleCreate: POST /api/agent/avatar tras configure OK; fallo del avatar no bloquea (log warning)
14|
15|## 3. Reskin
16|- [x] 3.1 wizard.css: label-caps generalizado, tarjeta preview (color-mix primary), botones color fijo, hover según patrón web — patch por bloques
17|
18|## 4. Verificación
19|- [x] 4.1 verify-jsx en cada .jsx/.css tocado
20|- [x] 4.2 Entorno de test sin config (backup de agent-config.json antes, restaurar después) → wizard completo de principio a fin con datos reales
21|- [x] 4.3 Avatar subido aparece en chat y ajustes; sin avatar no rompe
22|- [x] 4.4 Tema claro/oscuro + con y sin tema custom; 375px: wizard usable (scrollWidth ≤ 375)
23|- [x] 4.5 Fuente Outlined ya no se descarga (performance.getEntriesByType('resource') sin material+symbols+outlined)
24|- [x] 4.6 Sección Hecho en design.md + usuario aprueba