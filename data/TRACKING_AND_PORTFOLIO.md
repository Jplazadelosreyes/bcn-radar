# Estrategia de Portfolio y Analytics (Seguimiento de Reclutadores)

Este documento contiene las directrices para que la aplicación no solo sea una herramienta funcional, sino un **imán para reclutadores**, permitiendo saber cuándo interactúan con el producto.

## 1. Analytics y Seguimiento (Saber quién entra)
Claude debe implementar un sistema ligero de métricas en el frontend (sin necesidad de un backend complejo).

- **Google Analytics / PostHog:** Integrar un script básico de rastreo para ver el flujo de usuarios. PostHog es muy recomendable porque permite ver grabaciones de sesiones (puedes ver literalmente cómo el reclutador mueve el ratón por tu mapa).
- **Parámetros UTM (Tracking Links):** La app debe soportar lectura de parámetros en la URL. 
  - Ejemplo: Si pones el link en tu CV, pon `https://tu-web.com/?ref=cv_pdf`. Si lo pones en LinkedIn, `?ref=linkedin`. 
  - El frontend puede leer este parámetro y lanzar un evento de analítica específico: `"Visita desde CV"`.

## 2. El "Easter Egg" para Reclutadores
Una práctica excelente en proyectos de portfolio es poner un pequeño guiño para quienes inspeccionan la app.
- **Botón "Hire Me" / "Sobre el Autor":** Un modal accesible desde el menú que cuente brevemente que esta app nació de una necesidad real. 
- **Webhook Directo:** Si el reclutador hace clic en un botón de "Contactar" o "Ver perfil de LinkedIn", se puede disparar un *webhook* silencioso (usando un servicio gratuito como EmailJS o Formspree) que te envíe un email al instante: *"Un reclutador acaba de hacer clic en tu perfil desde BCN Radar"*.

## 3. Justicia Informativa (La historia de e-distribución)
Para darle un alma al proyecto, se sugiere incluir una sección llamada "Guía de Supervivencia" o "Casos Reales".
- Contar la historia de la burocracia de la luz no solo previene a otros, sino que demuestra a los reclutadores tu capacidad de identificar un problema del mundo real (pain point) y construir software para mitigarlo. El *storytelling* técnico es una de las habilidades más cotizadas hoy en día.
