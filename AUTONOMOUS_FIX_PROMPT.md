# Инструкция-Промпт для Автономного Выполнения: Полный комплекс доработок Truespace (Supabase + Безопасность P0 + Архитектура P1 + Качество P2)

> **Как запустить:** Скопируйте весь текст ниже (начиная со строки `--- START OF PROMPT ---`) и отправьте в диалог агента/IDE. Агент согласует общий план в одном сообщении и автономно выполнит все этапы от начала до конца, проверяя тесты и сборку после каждого шага.

---
--- START OF PROMPT ---

Ты выступаешь в роли ведущего Senior Fullstack & Security архитектора.
Перед тобой проект **Truespace** (система финансового учёта барного кейтеринга на стеке: React 18, Vite, TypeScript, Node.js Express, Repository Pattern `IFinanceStore`, Vitest).

Твоя задача — **полностью автономно, шаг за шагом, выполнить комплексную модернизацию проекта**, устранить все найденные уязвимости безопасности (P0), перевести систему на полноценное облачное хранилище Supabase (P1), исправить архитектурные дефекты и оптимизировать клиент (P1-P2), доведя 100% тестов и сборку до идеального состояния.

Не заставляй пользователя принимать рутинные технические решения. В первом ответе коротко подтверди готовность и этапы плана, после чего **сразу приступай к последовательной реализации**.

---

### ГЛАВНЫЕ ТРЕБОВАНИЯ И ПРАВИЛА:
1. **Сохранение функционала и логики:** Не ломать существующий UX, русификацию, специфику барного кейтеринга (5 счетов, привязка к ивентам, маржинальность, быстрый ввод за 5 секунд, парсер строк Telegram).
2. **Изоляция и валидация:** Любые финансовые расчёты ведутся с копеечной точностью (`round2`), сохраняются мультитенантность (`companyId`) и правила двойной записи.
3. **Бесшовный fallback:** Проект должен сохранять возможность автономной локальной работы при отсутствии подключения к Supabase (режим `STORAGE_MODE=json`).
4. **Контроль качества на каждом этапе:** После каждого смыслового шага запускать:
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   Все тесты (550+) должны оставаться «зелёными».

---

## ПЛАН РАБОТ

### ЭТАП 1: Настройка Supabase и реализация полноценного `SupabaseStore`
**Проблема:** В данный момент единственным источником истины является `JsonFileStore` (`data/truespace.json`), а в Supabase через `cloudMirror.ts` данные только дублируются в фоне. При деплое в облачные среды (Vercel, Render, Railway) данные удаляются при перезапуске контейнера. В `factory.ts` режим `STORAGE_MODE=supabase` переключается обратно на `JsonFileStore`.

**Что сделать:**
1. **Конфигурация окружения:**
   - Проверить наличие и структуру `.env.example` и `.env`.
   - Поддерживать переменные:
     ```env
     STORAGE_MODE=supabase # или json
     SUPABASE_URL=https://your-project.supabase.co
     SUPABASE_ANON_KEY=your-anon-key
     SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key
     PORT=3001
     HOST=0.0.0.0
     ```
2. **Создать `src/server/storage/SupabaseStore.ts`:**
   - Класс должен полностью реализовывать интерфейс `IFinanceStore` (`src/server/storage/interfaces.ts`).
   - Реализовать все методы через `@supabase/supabase-js` (используя service role key или клиент с контекстом тенанта):
     - `getCompanies`, `getCompanyById`, `createCompany`, `updateCompany`, `deleteCompany`
     - `getUsers`, `getUserById`, `saveUserProfile`, `getCompanyMembers`, `addCompanyMember`
     - `getAccounts`, `getAccountById`, `updateAccountBalance`, `adjustAccountBalance` (через SQL RPC или безопасную транзакцию/atomic update), `saveAccount`, `createAccount`, `deleteAccount`
     - `getPartners`, `getPartnerById`, `savePartner`, `deletePartner`
     - `getEvents`, `getEventById`, `createEvent`, `updateEvent`, `deleteEvent`
     - `getCategories`, `getCategoryById`, `saveCategory`, `deleteCategory`
     - `getTransactions`, `getTransactionById`, `createTransaction`, `updateTransaction`, `softDeleteTransaction`
     - `resetToSeed`, `importState`
   - Маппинг snake_case полей таблиц Supabase в camelCase моделей TypeScript и обратно.
3. **Обновить `src/server/storage/factory.ts`:**
   - При `mode === 'supabase'` и наличии `SUPABASE_URL` + ключа — возвращать экземпляр `SupabaseStore`.
   - Если переменные не заданы — логировать понятное предупреждение и безопасно переключаться на `JsonFileStore`.
4. **Скрипт начальной синхронизации/сидинга:**
   - Обеспечить утилиту/скрипт (`src/server/data/syncSeedToSupabase.ts`), который при пустой базе Supabase загружает начальные данные из `seed.ts` без ошибок уникальности.

---

### ЭТАП 2: Устранение критических уязвимостей безопасности (P0)

1. **Ликвидация захардкоженного пароля:**
   - В `src/server/routes/auth.ts` (строки ~160-168) удалить захардкоженный пароль `'Qazxsw123'` и специальное исключение для `admin@gmail.com`.
   - Авторизация администратора должна идти через стандартный защищённый механизм (хеширование паролей через `bcrypt`/`argon2`, Supabase Auth или проверку роли `isSuperAdmin` в БД).
2. **Удаление бэкдора с кодом `777111`:**
   - В `src/server/routes/auth.ts` (строки ~295, 357) полностью удалить условие `|| String(code).trim() === '777111'`.
   - Код должен проверяться строго по `verificationStore` с валидацией времени жизни (`expiresAt`) или через Supabase OTP `verifyOtp`.
3. **Ликвидация утечки кодов подтверждения в логи:**
   - В `src/server/routes/auth.ts` (строка ~271) убрать `console.log` с выводом сгенерированного кода в открытом виде для продакшена (оставить только для режима `NODE_ENV === 'test'`).
4. **Безопасная настройка CORS:**
   - В `src/server/app.ts` заменить открытый `app.use(cors())` на настраиваемый CORS с whitelist:
     - Поддержка `localhost` (порты 5173, 3000, 3001)
     - Поддержка локальной сети `http://192.168.*.*` и `http://10.*.*.*` для тестирования с мобильных устройств
     - Поддержка домена из переменной окружения `FRONTEND_URL` / `ALLOWED_ORIGINS`
5. **Устранение уязвимости с глобальной сессией одного пользователя:**
   - В `src/server/routes/auth.ts` удалить статическую переменную `let currentSessionUserId = 'user_nikita'`.
   - Реализовать честную передачу токена/сессии:
     - При логине возвращать токен авторизации (JWT / Bearer token / Supabase session access_token).
     - Создать middleware `authMiddleware.ts` в `src/server/middleware/auth.ts`, извлекающий `userId` и текущую организацию из заголовка `Authorization: Bearer <token>` или валидирующий сессию.
     - Для локального оффлайн-режима поддержать безопасный fallback с заголовком `x-user-id` только в `NODE_ENV === 'development'`.
6. **Строгий RBAC Middleware:**
   - Прекратить практику опциональных проверок в эндпоинтах `transactions.ts` и `accounts.ts`.
   - Создать middleware `requireRole(['owner', 'admin'])`. Если пользователь не аутентифицирован или не состоит в компании — возвращать строгий `401 Unauthorized` / `403 Forbidden`, а не пропускать запрос.

---

### ЭТАП 3: Исправление архитектурных дефектов и надежности (P1)

1. **Устранение состояния гонки в `updateTransaction`:**
   - В `src/server/services/FinanceService.ts` (строки ~382-442) переписать откат старого влияния и наложение нового через атомарный метод `adjustAccountBalance(id, delta)`, как это уже сделано в `deleteTransaction`.
   - Избегать шаблона «прочитал баланс -> сложил в памяти -> перезаписал через updateAccountBalance», чтобы конкурентные запросы не затирали друг друга.
2. **Асинхронная персистенция `JsonFileStore`:**
   - В `src/server/storage/JsonFileStore.ts` оптимизировать частые вызовы `persist()`: внедрить debounce (отложенную пакетную запись, например 100-300ms) или асинхронную атомарную запись во временный файл с заменой, чтобы синхронный `fs.writeFileSync` не блокировал Event Loop Node.js при нагрузке.
3. **Защита фронтенда от падений (Error Boundary):**
   - Создать компонент `src/client/components/common/ErrorBoundary.tsx` с красивым русскоязычным интерфейсом восстановления («Что-то пошло не так», кнопка «Обновить страницу», безопасный лог ошибки).
   - Обернуть корневой рендер в `src/client/main.tsx` и основные вкладки в `src/client/App.tsx`.
4. **Code Splitting и оптимизация бандла:**
   - В `src/client/App.tsx` перевести тяжёлые представления на `React.lazy` и `Suspense`:
     - `SettingsView`
     - `SuperAdminView`
     - `EventsView`
     - `TransactionHistory`
     - `StatementImportModal`
   - В `vite.config.ts` настроить разделение чанков (`manualChunks` для `react`, `lucide-react`, `xlsx`, `supabase`).
5. **Декомпозиция `FinanceContext.tsx`:**
   - Разбить гигантский контекст на логические зоны или изолировать стейты, чтобы частые фоновые обновления (например, поллинг статуса Telegram-бота каждые 30 секунд) не вызывали полный ререндер списка счетов и всей таблицы транзакций.

---

### ЭТАП 4: Качество кода, инфраструктура и полировка (P2)

1. **Строгая типизация DTO:**
   - В `src/server/services/FinanceService.ts` заменить сигнатуру `createTransaction(dto: any)` на строгий DTO-интерфейс `CreateTransactionDTO` из `src/shared/dto.ts`.
2. **Rate Limiting:**
   - Подключить `express-rate-limit` для критических роутов авторизации:
     - `/api/auth/login` (не более 10 попыток в 15 минут)
     - `/api/auth/send-code` и `/api/auth/verify-code` (не более 5 запросов в минуту)
3. **Логирование и скрытие внутренних ошибок:**
   - В клиенте (`FinanceContext.tsx`, `apiClient.ts`) убрать прямой вывод необработанных объектов в `console.error` в продакшен-режиме (`import.meta.env.PROD`).
   - В сервере не отдавать стек-трейсы наружу в ответе `500 Internal Server Error`.
4. **Source Maps:**
   - Включить `sourceMap: true` в `tsconfig.json`, `tsconfig.server.json` и `vite.config.ts` (или настроить отдельный продакшн sourcemap).
5. **CI/CD пайплайн:**
   - Создать файл `.github/workflows/ci.yml`:
     - Сборка на Node.js 20 и 22
     - Проверка типов: `npm run typecheck`
     - Запуск тестов: `npm test`
     - Продакшн сборка: `npm run build`
6. **Исправление хрупких тестов:**
   - Просмотреть тесты в `tests/`, где жёстко зафиксированы балансы (например, сумма сида 1 166 300 ₽). Изолировать тесты хранилища, инициализируя свежий `InMemoryStore` перед каждым тестом (`beforeEach`), чтобы они не ломались при изменении сид-данных.

---

### ИТОГОВЫЙ ОТЧЁТ:
После завершения всех шагов предоставь краткий структурированный отчёт:
1. Какие файлы были созданы или изменены.
2. Результаты запуска `npm run typecheck`, `npm test` и `npm run build`.
3. Инструкция по переключению на Supabase (как указать переменные в `.env` и проверить связь).
4. Обновление статуса в `PROJECT.md`.

Приступай к выполнению прямо сейчас!
--- END OF PROMPT ---
