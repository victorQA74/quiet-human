# Карта кода

```text
index.html → src/main.js
               ├─ ui.js + style.css → экраны и HUD
               ├─ input.js → намерения игрока
               ├─ audio.js → синтез звука
               ├─ game/model.js → состояние и правила
               │     ├─ levels.js → данные глав
               │     ├─ navigation.js → препятствия и A*
               │     ├─ hand.js → наведение человека, поворот, замах, контакт и общая опасная область руки
               │     └─ followers.js → подбор и цепочка паучат
               ├─ game/storage.js → локальный прогресс
               ├─ view/assets.js → загрузка локальных GLB и повтор при ошибке
               └─ view/scene.js → Three.js canvas и камера
                        ├─ characters.js → независимые скелеты и анимация
                        │      └─ hand-fit.js → поза, ладонь и контур запястья
                        ├─ objects.js → процедурное окружение
                        └─ batching.js → объединение статической геометрии

public/models/ → hand.glb, spider.glb, SOURCES.json и лицензии
scripts/diagnose-hand.mjs → покадровый наблюдатель без изменения состояния
scripts/measure-characters.mjs → геометрические измерения для калибровки
scripts/review-character-poses.mjs → четыре позы локального стенда, PNG и отчёт
artifacts/characters-review.html + review.html → интерактивный стенд и галерея приёмки

tests/*.test.js → node:test, без DOM/WebGL
tests/e2e/*.spec.js → Playwright, реальные pointer/keyboard
scripts/check-production.mjs → браузерная проверка dist без dev-диагностики
scripts/verify-video.mjs → проверка существующего видео без перекодирования
scripts/package-release.py + verify-release.py → упаковка, SHA-256 и состав dist/GLB
docs/ → спецификации, решения, критерии и фактические результаты
```

Производственный код не импортирует тесты и инструменты релиза. Модель не импортирует DOM, Three.js и localStorage. Сцена читает состояние и не решает, наступила ли победа.
