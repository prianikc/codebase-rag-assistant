# Codebase RAG Assistant

## Обзор проекта

**Codebase RAG Assistant** — локальный RAG-ассистент (Retrieval-Augmented Generation) для работы с кодовой базой с приоритетом приватности. Приложение позволяет загружать файлы и папки проекта, индексировать их в локальное векторное хранилище (IndexedDB) и общаться с кодом через чат-интерфейс.

### Ключевые возможности

- **Общение с кодом**: Вопросы о структуре проекта, логике и паттернах кода
- **Локальный RAG**: Векторное хранилище в IndexedDB, данные не покидают устройство
- **Множественные провайдеры LLM**: Gemini API и локальные LLM через LM Studio / OpenAI-совместимые эндпоинты
- **Speech функциональность**: Speech-to-Text и Text-to-Speech через Web Speech API, OpenAI, ElevenLabs
- **Инструкции проекта**: Автоматическая генерация инструкций для папок и файлов
- **Экспорт чата**: Экспорт истории диалогов в Markdown
- **Просмотр файлов**: Встроенный просмотрщик файлов с подсветкой синтаксиса

## Технологический стек

| Категория | Технология |
|-----------|------------|
| Frontend | Angular 21+ (Zoneless Change Detection, Signals) |
| Язык | TypeScript 5.9 |
| Сборка | Angular CLI (esbuild) |
| Деплой | Docker + Nginx |
| Векторное хранилище | IndexedDB |
| LLM провайдеры | Gemini API, OpenAI-совместимые эндпоинты |

## Структура проекта

```
src/
├── main.tsx                    # Точка входа в приложение
├── app.component.ts            # Корневой компонент
├── styles.css                  # Глобальные стили
├── styles/                     # CSS-модули (animations, reset, typography и др.)
├── core/                       # Основная бизнес-логика
│   ├── constants/              # Константы (file-filters, providers, storage-keys)
│   ├── models/                 # TypeScript модели (chat, llm, vector, speech)
│   ├── utils/                  # Утилиты (vector.utils)
│   └── environment.ts          # Конфигурация окружения
├── features/                   # UI-компоненты функциональности
│   ├── app-shell/              # Оболочка приложения (drag-and-drop)
│   ├── chat/                   # Чат-интерфейс с RAG
│   ├── sidebar/                # Проводник файлов с поиском
│   ├── settings/               # Настройки провайдеров и эмбеддингов
│   ├── file-viewer/            # Просмотрщик файлов
│   └── project-instructions/   # Управление инструкциями проекта
└── shared/                     # Переиспользуемые компоненты
    ├── components/             # UI-компоненты (confirmation-modal)
    ├── pipes/                  # Пайпы (markdown)
    ├── services/               # Сервисы (vector-store, indexed-db, llm)
    └── utils/                  # Утилиты (error.utils)

deploy/
└── nginx.conf                  # Конфигурация Nginx для Docker-деплоя
```

## Сборка и запуск

### Предварительные требования

- Node.js 20+
- Docker (опционально, для контейнеризированного запуска)

### Локальная разработка

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки (порт 3000)
npm start

# Сборка production-версии
npm run build

# Сборка в режиме watch
npm run watch

# Запуск unit-тестов
npm test

# Запуск тестов с покрытием кода
npm run test -- --code-coverage
```

### Docker-деплой

```bash
# Сборка и запуск
./deploy.sh up

# Остановка контейнеров
./deploy.sh down

# Просмотр логов
./deploy.sh logs

# Перезапуск
./deploy.sh restart

# Полная очистка (контейнеры, образы, тома)
./deploy.sh clean

# Статус контейнеров
./deploy.sh status
```

Приложение будет доступно по адресу `http://localhost:3000` (порт настраивается через `.env`).

### Конфигурация окружения

Создайте файл `.env` в корне проекта:

```env
APP_PORT=3000
```

> **Важно**: API-ключи управляются через LocalStorage браузера или интерфейс настроек приложения, а не через `.env`.

## Архитектурные особенности

### Zoneless Change Detection

Приложение использует `provideZonelessChangeDetection()` — отключена зональная детекция изменений Angular для улучшения производительности. Все изменения состояния отслеживаются через Signals.

### Standalone Components

Все компоненты являются standalone и не требуют NgModules. Импорты зависимостей указываются напрямую в декораторе `@Component`.

### Алиасы путей

В `tsconfig.json` настроен алиас `@/*` → `./*` для удобных импортов:

```typescript
import { SomeService } from '@/shared/services';
```

### Векторное хранилище

IndexedDB используется для локального хранения эмбеддингов. Это обеспечивает полную автономность и приватность данных.

## Ключевые сервисы

### KnowledgeBaseService

Отвечает за индексацию файлов и GitHub-репозиториев:
- Загрузка файлов через drag-and-drop или диалог
- Импорт GitHub-репозиториев по URL
- Чанкинг текста с учётом типа файла (код, данные, markdown)
- Параллельная генерация эмбеддингов с контролем конкурентности

### VectorStoreService

Управляет векторным хранилищем:
- Хранение документов с эмбеддингами в памяти (Signal)
- Персистентность в IndexedDB
- Поиск по косинусному сходству
- Отслеживание сигнатуры модели эмбеддингов

### LlmService

Работа с LLM провайдерами:
- Генерация эмбеддингов (Gemini / OpenAI-совместимые)
- Стриминг ответов чата
- Поддержка локальных LLM (LM Studio, Ollama)
- Конфигурация через Signal

### RagService

RAG-логика:
- Извлечение релевантного контекста из векторного хранилища
- Фильтрация по порогу релевантности (MIN_RELEVANCE_SCORE = 0.55)
- Формирование системного промпта с контекстом

## Модели данных

### ChatMessage

```typescript
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    sources?: ChatSource[];  // Источники RAG
    timestamp: Date;
}
```

### VectorDocument

```typescript
interface VectorDocument {
    id: string;
    filePath: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
}
```

### LlmConfig

```typescript
interface LlmConfig {
    chatProvider: LlmProvider;      // 'gemini' | 'openai'
    embeddingProvider: LlmProvider; // 'gemini' | 'openai'
    gemini: GeminiConfig;
    openaiChat: OpenAiConfig;
    openaiEmbedding: OpenAiConfig;
}
```

### SpeechConfig

```typescript
interface SpeechConfig {
    stt: SttConfig;  // Speech-to-Text
    tts: TtsConfig;  // Text-to-Speech
}
```

## Константы

### Фильтры файлов (`file-filters.const.ts`)

- `BINARY_EXTENSIONS` — бинарные расширения для исключения
- `BLOCKED_DIRECTORIES` — директории для пропуска (node_modules, .git и др.)
- `BLOCKED_FILENAMES` — lock-файлы и системные файлы
- `EMBEDDING_CONCURRENCY` — конкурентность эмбеддингов (4)
- `DOWNLOAD_CONCURRENCY` — конкурентность загрузки GitHub (10)

### Ключи хранилища (`storage-keys.const.ts`)

```typescript
const STORAGE_KEYS = {
    SESSIONS: 'rag_app_sessions',
    CURRENT_ID: 'rag_app_current_id',
    THEME: 'rag_app_theme',
    SPEECH: 'rag_app_speech',
    LLM_CONFIG: 'rag_app_llm_config',
};
```

## Правила разработки

### Стиль кодирования

- **TypeScript 5.9** с target `ES2022`
- **Standalone компоненты** — все компоненты standalone
- **Signals** — использование Angular Signals для реактивного состояния
- **Индексные файлы** — каждый модуль содержит `index.ts` для реэкспорта
- **Минимум декораторов** — предпочтение современным API Angular

### Структура feature-модулей

Каждая feature следует структуре:

```
feature-name/
├── index.ts              # Реэкспорт
├── container/            # Container-компоненты (умные)
│   ├── *.component.ts
│   ├── *.component.html
│   └── *.component.css
├── components/           # Presentational-компоненты
└── services/             # Feature-специфичные сервисы
```

### Работа с LLM провайдерами

Поддерживаются два типа провайдеров:
- `gemini` — Google Gemini API
- `openai` — OpenAI-совместимые эндпоинты (LM Studio, Ollama и др.)

### Работа с файлами

Поддерживаемые форматы и фильтры определены в `core/constants/file-filters.const.ts`.

### Хранение данных

Ключи localStorage определены в `core/constants/storage-keys.const.ts`. API-ключи хранятся в браузере, а не на сервере.

## Полезные команды

| Команда | Описание |
|---------|----------|
| `npm start` | Запуск dev-сервера (порт 3000) |
| `npm run build` | Production-сборка |
| `npm run watch` | Сборка в режиме watch |
| `npm test` | Запуск unit-тестов |
| `./deploy.sh up` | Docker-деплой |
| `./deploy.sh down` | Остановка контейнеров |
| `./deploy.sh logs` | Логи контейнеров |
| `./deploy.sh restart` | Перезапуск |
| `./deploy.sh clean` | Полная очистка Docker |

## Примечания

- Точка входа использует JSX-синтаксис (`main.tsx`), хотя это Angular-приложение
- Polyfill для `process.env` добавлен для совместимости с некоторыми библиотеками
- Чанкинг кода использует специальные разделители (перевод строки, `;`, `}`) для сохранения целостности блоков
- Порог релевантности RAG по умолчанию: 0.55 (55%)
