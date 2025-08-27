// telegraf-inline-router.ts (v10)
// Router for Telegraf inline keyboards with typed routes, text-input flows, back navigation,
// render modes (incl. smart), cancel flow, improved state key, user-friendly error handling,
// simple per-user mutex, async StateStore/TokenStore abstractions, DSL helpers, versioned callbacks,
// per-view showBack/showCancel overrides, improved naming, message pruning, and JSDoc.

import type { Context, Telegraf } from 'telegraf';
import { Markup } from 'telegraf';
import type {
  InlineKeyboardMarkup,
  Message,
} from 'telegraf/typings/core/types/typegram';

// ============================================================================
// 📚 Public API Types
// ============================================================================

/** Rendering strategy for route views. */
export type RenderMode = 'edit' | 'replace' | 'append' | 'smart';

/**
 * RouteView — данные для отрисовки экрана.
 * @template A Тип объекта действий (actions) вашего приложения
 */
export type RouteView<A = unknown> = {
  /** Текст сообщения. */
  text: string;
  /** Кнопки (строки можно задавать массивами). */
  buttons?: Array<Button<A> | Button<A>[]>;
  /** Отключить предпросмотр ссылок. */
  disablePreview?: boolean;
  /** Перекрыть глобальный режим рендера. */
  renderMode?: RenderMode;
  /** Показать кнопку «Назад» (локальный override). */
  showBack?: boolean;
  /** Показать кнопку «Отмена» (локальный override). */
  showCancel?: boolean;
};

/**
 * Функция программной навигации.
 * @template A Тип actions
 * @template P Тип params текущего роутера
 * @template NP Тип params следующего роутера
 * @param route Целевой роут
 * @param params Параметры для целевого роута
 */
export type NavigateFn<A = unknown> = <NP = unknown>(
  route: Route<A, NP>,
  params?: NP
) => Promise<void>;

/**
 * Аргументы экшена роута.
 * @template A Тип actions
 * @template P Тип params
 */
export type RouteActionArgs<A = unknown, P = unknown> = {
  /** telegraf ctx */
  ctx: Context;
  /** Ваш объект действий (доменные операции, проверка прав и т. п.) */
  actions: A;
  /** Параметры роута */
  params: P;
  /** Перейти на другой роут */
  navigate: NavigateFn<A>;
  /** Вернуться на предыдущий роут */
  navigateBack: () => Promise<void>;
  /** Текущее состояние роутера (для чтения) */
  state: RouterState;
};

/**
 * Описание роута.
 * @template A Тип actions
 * @template P Тип params
 */
export type Route<A = unknown, P = unknown> = {
  /** Уникальный ID роута */
  id: string;
  /** Если true — роут ожидает текстового ввода */
  waitForText?: boolean;
  /** Экшен роута: возвращает View (для рендера) или ничего (если сам навигирует) */
  action: (
    args: RouteActionArgs<A, P>
  ) => Promise<void | RouteView<A>> | void | RouteView<A>;
};

/**
 * Описание кнопки для inline-клавиатуры.
 * @template A Тип actions
 */
export type Button<A = unknown> = {
  /** Текст кнопки */
  text: string;
  /** Данные коллбэка (желательно через cb/cbTok) */
  callback: string;
  /** Необязательный хендлер нажатия */
  action?: (args: {
    ctx: Context;
    actions: A;
    navigate: NavigateFn<A>;
    navigateBack: () => Promise<void>;
  }) => Promise<void> | void;
};

/**
 * Узел дерева роутинга (для сборки иерархии и наследования hasBack).
 */
export type RouteNode<A = unknown> = {
  route: Route<A, unknown>;
  /** Добавить «Назад» для этого узла и всех «простых» детей */
  hasBack?: boolean; // default: false
  /** Дочерние роуты (можно передавать как Route или как RouteNode) */
  children?: Array<RouteNode<A> | Route<A, unknown>>;
};

/**
 * Хранимое состояние роутера (на сессию chatId:userId).
 */
export type RouterState = {
  /** Стек ID роутов для навигации */
  stack: string[];
  /** Параметры каждого роута по его ID */
  params: Record<string, unknown>;
  /** Какой роут сейчас ждёт текст */
  awaitingTextRouteId?: string;
  /**
   * Мета по отрисованным сообщениям (для корректного edit/delete и поиска кнопки по messageId).
   * Держим ограниченное число записей (см. StartOptions.maxMessages)
   */
  messages: Array<{
    messageId: number;
    text: string;
    buttons: Button<unknown>[][];
    showBack: boolean;
    showCancel: boolean;
  }>;
};

/**
 * Опции запуска роутера.
 * @template A Тип actions
 */
export type StartOptions = {
  /** Текст подсказки для ввода, когда waitForText=true */
  inputPrompt?: string;
  /** Подпись кнопки «Назад» */
  backLabel?: string;
  /** callback_data кнопки «Назад» */
  backCallbackData?: string;
  /** Глобальный режим рендера экранов */
  renderMode?: RenderMode;
  /** Поведение при неудачном edit */
  onEditFail?: 'reply' | 'replace' | 'ignore';
  /** Режим рендера ошибок */
  errorRenderMode?: RenderMode;
  /** Префикс в тексте ошибок */
  errorPrefix?: string;
  /** Подпись кнопки «Отмена» (для ожидания ввода) */
  cancelLabel?: string;
  /** callback_data кнопки «Отмена» */
  cancelCallbackData?: string;
  /** Список строк, которые считаются «отменой» в тексте */
  cancelCommands?: string[];
  /** Показывать кнопку «Отмена» при ожидании ввода */
  showCancelOnWait?: boolean;
  /** Версия формата callback_data по умолчанию */
  cbVersion?: string;
  /** Хук логирования ошибок */
  onError?: (err: unknown, ctx: Context, state: RouterState) => void;
  /** Внешнее асинхронное хранилище состояния (Redis/DB); по умолчанию — память процесса */
  stateStore?: StateStore;
  /** Хранилище токенов для длинных payload; по умолчанию — память процесса */
  tokenStore?: TokenStore;
  /** Максимум записей в state.messages; при переполнении удаляем лишние из state и из чата */
  maxMessages?: number;
};

// ============================================================================
// 🔔 Errors & Helpers
// ============================================================================

/**
 * Исключение для контролируемых (пользовательских) ошибок в экшенах.
 * Показывается пользователю в виде View (или текстом с префиксом errorPrefix).
 */
export class RouterUserError extends Error {
  /** Кастомный View для ошибки (частичный) */
  view?: Partial<RouteView<unknown>>;
  constructor(message: string, view?: Partial<RouteView<unknown>>) {
    super(message);
    this.name = 'RouterUserError';
    this.view = view;
  }
}

/**
 * Безопасный доступ к эмулированному `ctx.match` (как в telegraf Hears/Action).
 * @param ctx Telegraf Context
 * @returns Массив совпадений или undefined
 */
export function getMatch(ctx: Context): readonly string[] | undefined {
  return (ctx as Context & { match?: string[] }).match;
}

// ============================================================================
// 🧱 DSL (Public)
// ============================================================================

/**
 * Набор хелперов для декларативной сборки клавиатур.
 */
export const DSL = {
  /**
   * Одна строка кнопок.
   * @template A
   * @param btns Список кнопок
   * @returns Строка кнопок (массив)
   */
  row<A = unknown>(...btns: Button<A>[]): Button<A>[] {
    return btns;
  },

  /**
   * Несколько строк кнопок.
   * @template A
   * @param lines Строки (или одиночные кнопки — будут обёрнуты в строку)
   * @returns Массив строк
   */
  rows<A = unknown>(
    ...lines: Array<Button<A> | Button<A>[]>
  ): Array<Button<A> | Button<A>[]> {
    return lines;
  },

  /**
   * Пейджер (строка из Prev/Next).
   * @template A
   * @param page Текущая страница (1..pages)
   * @param pages Всего страниц
   * @param prev Кнопка «назад по странице»
   * @param next Кнопка «вперёд по странице»
   */
  pager<A = unknown>(
    page: number,
    pages: number,
    prev: Button<A>,
    next: Button<A>
  ): Button<A>[] {
    const out: Button<A>[] = [];
    if (page > 1) out.push(prev);
    if (page < pages) out.push(next);
    return out;
  },
};

// ============================================================================
// 🗃️ StateStore & TokenStore
// ============================================================================

/** Асинхронное хранилище состояния роутера. Реализуйте адаптер под Redis/DB. */
export interface StateStore {
  /** Получить состояние по идентификаторам чата и пользователя */
  get(chatId: number, userId: number): Promise<RouterState | undefined>;
  /** Сохранить состояние */
  set(chatId: number, userId: number, state: RouterState): Promise<void>;
  /** Удалить состояние */
  delete(chatId: number, userId: number): Promise<void>;
}

/** In-memory реализация StateStore (для разработки/одиночного инстанса). */
class InMemoryStateStore implements StateStore {
  private map = new Map<string, RouterState>();
  async get(chatId: number, userId: number): Promise<RouterState | undefined> {
    return this.map.get(`${chatId}:${userId}`);
  }
  async set(chatId: number, userId: number, state: RouterState): Promise<void> {
    this.map.set(`${chatId}:${userId}`, state);
  }
  async delete(chatId: number, userId: number): Promise<void> {
    this.map.delete(`${chatId}:${userId}`);
  }
}

/** Хранилище токенов для длинных payload (callback_data → token → payload). */
export interface TokenStore {
  /** Сохранить payload и вернуть токен (с TTL, если задан) */
  save(data: unknown, ttlMs?: number): Promise<string> | string;
  /** Загрузить payload по токену */
  load(token: string): Promise<unknown | undefined> | unknown | undefined;
  /** Удалить токен (опционально) */
  delete?(token: string): Promise<void> | void;
}

/** In-memory реализация TokenStore (TTL на стороне процесса). */
class InMemoryTokenStore implements TokenStore {
  private map = new Map<string, { data: unknown; exp?: number }>();
  save(data: unknown, ttlMs?: number): string {
    const token = Math.random().toString(36).slice(2, 10);
    const exp = ttlMs ? Date.now() + ttlMs : undefined;
    this.map.set(token, { data, exp });
    return token;
  }
  load(token: string): unknown | undefined {
    const rec = this.map.get(token);
    if (!rec) return undefined;
    if (rec.exp && Date.now() > rec.exp) {
      this.map.delete(token);
      return undefined;
    }
    return rec.data;
  }
  delete(token: string): void {
    this.map.delete(token);
  }
}

// ============================================================================
// 🔗 Callback helpers (versioned)
// ============================================================================

/**
 * Сформировать callback_data с версией.
 * @param routeId ID роута
 * @param args Аргументы, разделяемые ':'
 * @param cbVersion Версия формата (по умолчанию 'v1')
 * @returns Строка callback_data вида `route!vX:...`
 */
export function cb(
  routeId: string,
  args: Array<string | number> = [],
  cbVersion = 'v1'
): string {
  const tail = args.length ? `:${args.join(':')}` : '';
  return `${routeId}!${cbVersion}${tail}`;
}

/**
 * Разобрать callback_data, созданный через cb/cbTok.
 * @param data Исходная строка callback_data
 * @returns Объект с routeId, cbVersion, args; а также признаком token-формы
 */
export function parseCb(data: string): {
  routeId: string;
  cbVersion?: string;
  args: string[];
  isToken: boolean;
  token?: string;
} {
  const [head, ...rest] = data.split(':');
  const [routeId, version] = head.split('!');
  if (!version) {
    return { routeId: head, cbVersion: undefined, args: rest, isToken: false };
  }
  if (rest[0] === 't') {
    return {
      routeId,
      cbVersion: version,
      args: rest.slice(1),
      isToken: true,
      token: rest[1],
    };
  }
  return { routeId, cbVersion: version, args: rest, isToken: false };
}

/**
 * Сформировать callback_data с токеном (payload хранится в TokenStore и не лезет в лимит 64 байта).
 * @param routeId ID роута
 * @param tokenStore Реализация TokenStore
 * @param payload Любые данные, которые нужно связать с кнопкой
 * @param ttlMs TTL для токена (по умолчанию 10 мин)
 * @param cbVersion Версия формата
 */
export async function cbTok(
  routeId: string,
  tokenStore: TokenStore,
  payload: unknown,
  ttlMs = 10 * 60_000,
  cbVersion = 'v1'
): Promise<string> {
  const token = await tokenStore.save(payload, ttlMs);
  return `${routeId}!${cbVersion}:t:${token}`;
}

// ============================================================================
// 🧰 Builders (Public)
// ============================================================================

/** Создать роут (удобный конструктор с типами). */
export function route<A = unknown, P = unknown>(cfg: Route<A, P>): Route<A, P> {
  return cfg;
}
/** Создать кнопку (удобный конструктор с типами). */
export function button<A = unknown>(cfg: Button<A>): Button<A> {
  return cfg;
}

/**
 * Экземпляр запущенного роутера (после run). Позволяет вешать общий onText и навигировать программно.
 */
export interface RunningRouter<A = unknown> {
  /** Текстовый fallback-хендлер, когда НЕ ждём ввода */
  onText(fn: (ctx: Context) => Promise<void> | void): void;
  /** Программная навигация на конкретный роут */
  navigate(
    ctx: Context,
    route: Route<A, unknown>,
    params?: unknown
  ): Promise<void>;
  /** Программная навигация «Назад» */
  navigateBack(ctx: Context): Promise<void>;
}

// ============================================================================
// ⚙️ Internal implementation
// ============================================================================

const DEFAULTS: Required<
  Omit<StartOptions, 'onError' | 'stateStore' | 'tokenStore'>
> & {
  onError?: StartOptions['onError'];
  stateStore: StateStore;
  tokenStore: TokenStore;
} = {
  inputPrompt: '✍️ Введите значение…',
  backLabel: '⬅️ Назад',
  backCallbackData: '__router_back__',
  renderMode: 'smart',
  onEditFail: 'reply',
  errorRenderMode: 'append',
  errorPrefix: '⚠️ ',
  cancelLabel: '✖️ Отмена',
  cancelCallbackData: '__router_cancel__',
  cancelCommands: ['/cancel', 'отмена', 'Отмена'],
  showCancelOnWait: true,
  cbVersion: 'v1',
  onError: undefined,
  stateStore: new InMemoryStateStore(),
  tokenStore: new InMemoryTokenStore(),
  maxMessages: 10,
};

function isConfigNode<A>(maybeNode: unknown): maybeNode is RouteNode<A> {
  return (
    !!maybeNode &&
    typeof maybeNode === 'object' &&
    'route' in (maybeNode as Record<string, unknown>)
  );
}

/**
 * Простой процессовый мьютекс по ключу (chatId:userId) для сериализации апдейтов.
 * Не распределённый. Для кластера используйте Redlock/иное.
 */
class SimpleMutex {
  private queue = new Map<string, Promise<void>>();
  /**
   * Выполнить функцию эксклюзивно для данного ключа.
   * @param key Ключ блокировки
   * @param fn Асинхронная операция
   */
  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.queue.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => (release = resolve));
    this.queue.set(key, current);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.queue.get(key) === current) this.queue.delete(key);
    }
  }
}

/**
 * Создать роутер и выполнить связывание с Telegraf.
 * @template A Тип actions
 * @param tree Иерархия роутов (Route/RouteNode)
 * @param optionsIn Опции запуска
 */
export function createRouter<A = unknown>(
  tree: Array<RouteNode<A> | Route<A, unknown>>,
  optionsIn: StartOptions = {}
): {
  /** Инициализировать обработчики на Telegraf и вернуть объект управления. */
  run: (bot: Telegraf<Context>, actions: A) => RunningRouter<A>;
} {
  const options = {
    ...DEFAULTS,
    ...optionsIn,
    stateStore: optionsIn.stateStore ?? DEFAULTS.stateStore,
    tokenStore: optionsIn.tokenStore ?? DEFAULTS.tokenStore,
  };

  type Entry = {
    route: Route<A, unknown>;
    parentId: string | null;
    hasBackEffective: boolean;
  };
  const entries = new Map<string, Entry>();

  const ensureUnique = (routeId: string): void => {
    if (entries.has(routeId)) throw new Error(`Duplicate route id: ${routeId}`);
  };

  const walk = (
    node: RouteNode<A> | Route<A, unknown>,
    parentId: string | null,
    parentHasBackEffective: boolean
  ): void => {
    const route: Route<A, unknown> = isConfigNode<A>(node)
      ? (node as RouteNode<A>).route
      : (node as Route<A, unknown>);
    const id = route.id;
    ensureUnique(id);

    const hasBackEffective = isConfigNode<A>(node)
      ? !!((node as RouteNode<A>).hasBack ?? false)
      : !!parentHasBackEffective;

    entries.set(id, { route, parentId, hasBackEffective });

    const children = isConfigNode<A>(node)
      ? (node as RouteNode<A>).children
      : undefined;
    if (children?.length) {
      for (const child of children)
        walk(child as RouteNode<A> | Route<A, unknown>, id, hasBackEffective);
    }
  };

  for (const node of tree) walk(node, null, false);

  const mutex = new SimpleMutex();

  // --- state keyed by chat+user in external store
  const getIds = (ctx: Context): { chatId: number; userId: number } => ({
    chatId: ctx.chat?.id ?? 0,
    userId: ctx.from?.id ?? 0,
  });
  const getKey = (ctx: Context): string => {
    const { chatId, userId } = getIds(ctx);
    return `${chatId}:${userId}`;
  };
  const getState = async (ctx: Context): Promise<RouterState> => {
    const { chatId, userId } = getIds(ctx);
    let state = await options.stateStore.get(chatId, userId);
    if (!state) {
      state = { stack: [], params: {}, messages: [] };
      await options.stateStore.set(chatId, userId, state);
    }
    return state;
  };
  const setState = async (ctx: Context, state: RouterState): Promise<void> => {
    const { chatId, userId } = getIds(ctx);
    await options.stateStore.set(chatId, userId, state);
  };

  const getEntry = (routeId?: string): Entry | undefined =>
    routeId ? entries.get(routeId) : undefined;
  const getCurrentRouteId = (state: RouterState): string | undefined =>
    state.stack[state.stack.length - 1];

  const ensureRows = (
    buttons?: Array<Button<A> | Button<A>[]>
  ): Button<unknown>[][] => {
    if (!buttons?.length) return [];
    const rows: Button<unknown>[][] = [];
    for (const button of buttons)
      rows.push(
        (Array.isArray(button) ? button : [button]) as Button<unknown>[]
      );
    return rows;
  };

  const buttonsEqual = (
    left: Button<unknown>[][],
    right: Button<unknown>[][]
  ): boolean => {
    if (left.length !== right.length) return false;
    for (let rowIndex = 0; rowIndex < left.length; rowIndex++) {
      if (left[rowIndex].length !== right[rowIndex].length) return false;
      for (let colIndex = 0; colIndex < left[rowIndex].length; colIndex++) {
        if (
          left[rowIndex][colIndex].text !== right[rowIndex][colIndex].text ||
          left[rowIndex][colIndex].callback !==
            right[rowIndex][colIndex].callback
        )
          return false;
      }
    }
    return true;
  };

  /**
   * Собрать inline-клавиатуру с учётом локальных/глобальных флагов «Назад»/«Отмена».
   */
  const buildKeyboardMarkup = (
    rows: Button<unknown>[][],
    showBack: boolean,
    showCancel: boolean
  ): InlineKeyboardMarkup => {
    const keyboardRows = rows.map((row) =>
      row.map((button) => Markup.button.callback(button.text, button.callback))
    );
    if (showBack || showCancel) {
      const extraRow: ReturnType<typeof Markup.button.callback>[] = [];
      if (showCancel)
        extraRow.push(
          Markup.button.callback(
            options.cancelLabel,
            options.cancelCallbackData
          )
        );
      if (showBack)
        extraRow.push(
          Markup.button.callback(options.backLabel, options.backCallbackData)
        );
      keyboardRows.push(extraRow);
    }
    return Markup.inlineKeyboard(keyboardRows).reply_markup;
  };

  /**
   * Обрезка лишних сообщений: удаляем из чата (если можно) и из state.
   */
  async function pruneOverflow(ctx: Context, st: RouterState): Promise<void> {
    const limit = options.maxMessages;
    const overflow = Math.max(0, st.messages.length - limit);
    if (overflow <= 0) return;
    const toDrop = st.messages.slice(0, overflow); // самые старые
    for (const m of toDrop) {
      try {
        await ctx.deleteMessage(m.messageId);
      } catch {
        /* ignore */
      }
    }
    st.messages = st.messages.slice(overflow);
    await setState(ctx, st);
  }

  /**
   * Отрисовать View с выбранной стратегией и учётом состояния.
   */
  async function renderView(
    ctx: Context,
    view: RouteView<A> | undefined,
    inheritedShowBack: boolean,
    inheritedShowCancel: boolean
  ): Promise<void> {
    const state = await getState(ctx);
    const rows = ensureRows(view?.buttons);

    // локальные override
    const finalBack =
      typeof view?.showBack === 'boolean' ? view.showBack : inheritedShowBack;
    const finalCancel =
      typeof view?.showCancel === 'boolean'
        ? view.showCancel
        : inheritedShowCancel;

    const keyboardMarkup = buildKeyboardMarkup(rows, finalBack, finalCancel);
    const mode: RenderMode = (view?.renderMode ??
      options.renderMode) as RenderMode;

    // helper to record message mapping
    const remember = async (messageId: number): Promise<void> => {
      const entry = {
        messageId,
        text: view?.text ?? '',
        buttons: rows as Button<unknown>[][],
        showBack: finalBack,
        showCancel: finalCancel,
      };
      const idx = state.messages.findIndex((m) => m.messageId === messageId);
      if (idx >= 0) state.messages[idx] = entry;
      else state.messages.push(entry);
      await setState(ctx, state);
      await pruneOverflow(ctx, state);
    };
    if (mode === 'append') {
      const sentMessage = await ctx.reply(view?.text ?? '', {
        reply_markup: keyboardMarkup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const sentId = (sentMessage as Message).message_id;
      if (sentId) await remember(sentId);
      return;
    }

    if (mode === 'replace') {
      const mid = (
        ctx as Context & {
          callbackQuery?: { message?: { message_id?: number } };
        }
      ).callbackQuery?.message?.message_id;
      const targetId =
        mid ?? state.messages[state.messages.length - 1]?.messageId;
      if (targetId) {
        try {
          await ctx.deleteMessage(targetId);
          state.messages = state.messages.filter(
            (m) => m.messageId !== targetId
          );
          await setState(ctx, state);
        } catch {
          /* ignore */
        }
      }
      const sentMessage = await ctx.reply(view?.text ?? '', {
        reply_markup: keyboardMarkup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const sentId = (sentMessage as Message).message_id;
      if (sentId) await remember(sentId);
      return;
    }

    // default 'smart' / 'edit'
    const mid = (
      ctx as Context & { callbackQuery?: { message?: { message_id?: number } } }
    ).callbackQuery?.message?.message_id;

    if (mode === 'smart' && mid) {
      const prev = state.messages.find((m) => m.messageId === mid);
      if (
        prev &&
        prev.text === (view?.text ?? '') &&
        buttonsEqual(prev.buttons, rows) &&
        prev.showBack === finalBack &&
        prev.showCancel === finalCancel
      ) {
        return; // no-op
      }
      try {
        await ctx.editMessageText(view?.text ?? '', {
          reply_markup: keyboardMarkup,
          link_preview_options: { is_disabled: view?.disablePreview ?? true },
        });
        await remember(mid);
        return;
      } catch {
        // fall through → onEditFail
      }
      if (options.onEditFail === 'replace') {
        try {
          await ctx.deleteMessage(mid);
          state.messages = state.messages.filter((m) => m.messageId !== mid);
          await setState(ctx, state);
        } catch {
          /* ignore */
        }
      } else if (options.onEditFail === 'ignore') {
        return;
      }
      const sentMessage = await ctx.reply(view?.text ?? '', {
        reply_markup: keyboardMarkup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const sentId = (sentMessage as Message).message_id;
      if (sentId) await remember(sentId);
      return;
    }

    if (mode === 'edit') {
      if (mid) {
        try {
          await ctx.editMessageText(view?.text ?? '', {
            reply_markup: keyboardMarkup,
            link_preview_options: { is_disabled: view?.disablePreview ?? true },
          });
          await remember(mid);
          return;
        } catch {
          if (options.onEditFail === 'replace') {
            try {
              await ctx.deleteMessage(mid);
              state.messages = state.messages.filter(
                (m) => m.messageId !== mid
              );
              await setState(ctx, state);
            } catch {
              /* ignore */
            }
          } else if (options.onEditFail === 'ignore') {
            return;
          }
          const sentMessage = await ctx.reply(view?.text ?? '', {
            reply_markup: keyboardMarkup,
            link_preview_options: { is_disabled: view?.disablePreview ?? true },
          });
          const sentId = (sentMessage as Message).message_id;
          if (sentId) await remember(sentId);
          return;
        }
      }
      const sentMessage = await ctx.reply(view?.text ?? '', {
        reply_markup: keyboardMarkup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const sentId = (sentMessage as Message).message_id;
      if (sentId) await remember(sentId);
      return;
    }

    // fallback
    const sentMessage = await ctx.reply(view?.text ?? '', {
      reply_markup: keyboardMarkup,
      link_preview_options: { is_disabled: view?.disablePreview ?? true },
    });
    const sentId = (sentMessage as Message).message_id;
    if (sentId) await remember(sentId);
  }

  /** Перейти на указанный роут, сохранив стек и вызвав его action. */
  async function _navigate<NP = unknown>(
    ctx: Context,
    route: Route<A, NP>,
    params?: NP
  ): Promise<void> {
    const state = await getState(ctx);
    state.stack.push(route.id);
    state.params[route.id] = params as unknown;

    const e = getEntry(route.id);
    if (!e) throw new Error(`Route not found: ${route.id}`);
    const inheritedShowBack = e.hasBackEffective && !!e.parentId;

    if (route.waitForText) {
      state.awaitingTextRouteId = route.id;
      const inheritedShowCancel = options.showCancelOnWait === true;
      await renderView(
        ctx,
        { text: options.inputPrompt, buttons: [] },
        inheritedShowBack,
        inheritedShowCancel
      );
      await setState(ctx, state);
      return;
    }

    state.awaitingTextRouteId = undefined;
    await setState(ctx, state);
    try {
      function navigateImpl<NP = unknown>(
        r: Route<A, NP>,
        p?: NP
      ): Promise<void> {
        return _navigate(ctx, r, p);
      }
      const view = await route.action({
        ctx,
        actions: currentActions as A,
        params: params as NP,
        navigate: navigateImpl,
        navigateBack: () => _navigateBack(ctx),
        state,
      });
      if (view)
        await renderView(ctx, view as RouteView<A>, inheritedShowBack, false);
    } catch (err) {
      await handleError(ctx, err, inheritedShowBack, false);
    }
  }

  /** Перейти «Назад» на предыдущий роут из стека. */
  async function _navigateBack(ctx: Context): Promise<void> {
    const state = await getState(ctx);
    state.stack.pop();
    state.awaitingTextRouteId = undefined;
    await setState(ctx, state);

    const currentId = getCurrentRouteId(state);
    if (!currentId) {
      try {
        await ctx.editMessageReplyMarkup(undefined);
      } catch {
        /* ignore */
      }
      return;
    }

    const e = getEntry(currentId);
    if (!e) return;
    const route = e.route;
    const params = state.params[currentId];
    const inheritedShowBack = e.hasBackEffective && !!e.parentId;

    if (route.waitForText) {
      const inheritedShowCancel = options.showCancelOnWait === true;
      await renderView(
        ctx,
        { text: options.inputPrompt },
        inheritedShowBack,
        inheritedShowCancel
      );
      state.awaitingTextRouteId = currentId;
      await setState(ctx, state);
      return;
    }

    try {
      function navigateImpl<NP = unknown>(
        r: Route<A, NP>,
        p?: NP
      ): Promise<void> {
        return _navigate(ctx, r, p);
      }
      const view = await route.action({
        ctx,
        actions: currentActions as A,
        params,
        navigate: navigateImpl,
        navigateBack: () => _navigateBack(ctx),
        state,
      });
      if (view)
        await renderView(ctx, view as RouteView<A>, inheritedShowBack, false);
    } catch (err) {
      await handleError(ctx, err, inheritedShowBack, false);
    }
  }

  /** Отменить ожидание текста и вернуться назад. */
  async function _cancelWait(ctx: Context): Promise<void> {
    const state = await getState(ctx);
    if (state.awaitingTextRouteId) {
      const rid = state.awaitingTextRouteId;
      if (rid === getCurrentRouteId(state)) state.stack.pop();
      state.awaitingTextRouteId = undefined;
      await setState(ctx, state);
    }
    await _navigateBack(ctx);
  }

  /** Унифицированный показ ошибок (RouterUserError — красиво, прочие — общим текстом). */
  async function handleError(
    ctx: Context,
    err: unknown,
    inheritedShowBack: boolean,
    inheritedShowCancel: boolean
  ): Promise<void> {
    const st = await getState(ctx);
    options.onError?.(err, ctx, st);
    if (err instanceof RouterUserError) {
      const v: RouteView<unknown> = {
        text: (err.view?.text ??
          `${options.errorPrefix}${err.message}`) as string,
        buttons:
          (err.view?.buttons as
            | Button<unknown>[]
            | Button<unknown>[][]
            | undefined) ?? [],
        disablePreview:
          (err.view?.disablePreview as boolean | undefined) ?? true,
        renderMode:
          (err.view?.renderMode as RenderMode | undefined) ??
          options.errorRenderMode,
      };
      await renderView(
        ctx,
        v as RouteView<A>,
        inheritedShowBack,
        inheritedShowCancel
      );
      return;
    }
    const v: RouteView<unknown> = {
      text: `${options.errorPrefix}Неизвестная ошибка`,
      buttons: [],
      renderMode: options.errorRenderMode,
    };
    await renderView(
      ctx,
      v as RouteView<A>,
      inheritedShowBack,
      inheritedShowCancel
    );
  }

  let currentActions: A | null = null;

  // ------------------------------------------------------------------------
  // Telegraf bindings
  // ------------------------------------------------------------------------

  return {
    run(bot: Telegraf<Context>, actions: A): RunningRouter<A> {
      currentActions = actions;

      // callback_query
      bot.on('callback_query', async (ctx) => {
        const key = getKey(ctx);
        await mutex.runExclusive(key, async () => {
          const state = await getState(ctx);
          const data = (ctx as Context & { callbackQuery?: { data?: string } })
            .callbackQuery?.data as string | undefined;
          if (!data) return;

          const parsed = parseCb(data);
          // эмулируем ctx.match = [full, ...args]
          (ctx as Context & { match?: string[] }).match = [
            data,
            ...parsed.args,
          ];

          try {
            await ctx.answerCbQuery();
          } catch {
            /* ignore */
          }

          if (data === options.cancelCallbackData) {
            await _cancelWait(ctx);
            return;
          }
          if (data === options.backCallbackData) {
            await _navigateBack(ctx);
            return;
          }

          // Найдём кнопку по message_id, чтобы привязать обработчик к конкретной клавиатуре
          const mid = (
            ctx as Context & {
              callbackQuery?: { message?: { message_id?: number } };
            }
          ).callbackQuery?.message?.message_id;
          let matched: Button<A> | undefined;
          if (mid) {
            const messageEntry = state.messages.find(
              (m) => m.messageId === mid
            );
            if (messageEntry) {
              outer1: for (const row of messageEntry.buttons as Button<A>[][]) {
                for (const button of row) {
                  if (button.callback === data) {
                    matched = button;
                    break outer1;
                  }
                }
              }
            }
          }
          if (!matched) {
            const last = state.messages[state.messages.length - 1];
            if (last) {
              outer2: for (const row of last.buttons as Button<A>[][]) {
                for (const button of row) {
                  if (button.callback === data) {
                    matched = button;
                    break outer2;
                  }
                }
              }
            }
          }

          if (matched?.action) {
            try {
              function navigateImpl<NP = unknown>(
                r: Route<A, NP>,
                p?: NP
              ): Promise<void> {
                return _navigate(ctx, r, p);
              }
              await matched.action({
                ctx,
                actions: currentActions as A,
                navigate: navigateImpl,
                navigateBack: () => _navigateBack(ctx),
              });
            } catch (err) {
              const curId = getCurrentRouteId(state);
              if (!curId) return;
              const e = getEntry(curId);
              const inheritedShowBack = !!e?.hasBackEffective && !!e?.parentId;
              await handleError(ctx, err, inheritedShowBack, false);
            }
            return;
          }

          // Фоллбэк: трактуем префикс как id роута
          const rid = parsed.routeId;
          const e = getEntry(rid);
          if (e) {
            const params = state.params[rid];
            await _navigate(ctx, e.route, params);
            return;
          }
        });
      });

      // text while waiting
      bot.on('text', async (ctx, next) => {
        const key = getKey(ctx);
        await mutex.runExclusive(key, async () => {
          const state = await getState(ctx);
          const rid = state.awaitingTextRouteId;
          if (!rid) {
            await next();
            return;
          }

          const txt = (
            ctx as Context & { message?: { text?: string } }
          ).message?.text?.trim();
          if (
            txt &&
            options.cancelCommands.some(
              (c) => c.toLowerCase() === txt.toLowerCase()
            )
          ) {
            await _cancelWait(ctx);
            return;
          }

          const e = getEntry(rid);
          if (!e) {
            await next();
            return;
          }
          const route = e.route;
          const params = state.params[rid];
          try {
            function navigateImpl<NP = unknown>(
              r: Route<A, NP>,
              p?: NP
            ): Promise<void> {
              return _navigate(ctx, r, p);
            }
            const result = await route.action({
              ctx,
              actions: currentActions as A,
              params,
              navigate: navigateImpl,
              navigateBack: () => _navigateBack(ctx),
              state: state,
            });
            if (result) {
              const inheritedShowBack = e.hasBackEffective && !!e.parentId;
              await renderView(
                ctx,
                result as RouteView<A>,
                inheritedShowBack,
                false
              );
              state.awaitingTextRouteId = undefined;
              await setState(ctx, state);
            } else {
              await _navigateBack(ctx);
            }
          } catch (err) {
            const inheritedShowBack = e.hasBackEffective && !!e.parentId;
            await handleError(ctx, err, inheritedShowBack, true);
          }
        });
      });

      // fallback text when NOT waiting
      let onTextFallback: ((ctx: Context) => Promise<void> | void) | null =
        null;
      bot.on('text', async (ctx) => {
        const st = await getState(ctx);
        if (st.awaitingTextRouteId) return;
        if (onTextFallback) await onTextFallback(ctx);
      });

      return {
        onText(fn: (ctx: Context) => Promise<void> | void): void {
          onTextFallback = fn;
        },
        navigate(
          ctx: Context,
          route: Route<A, unknown>,
          params?: unknown
        ): Promise<void> {
          return mutex.runExclusive(getKey(ctx), () =>
            _navigate(ctx, route, params)
          );
        },
        navigateBack(ctx: Context): Promise<void> {
          return mutex.runExclusive(getKey(ctx), () => _navigateBack(ctx));
        },
      };
    },
  };
}

// ============================================================================
// 📝 Notes
// - Ограничения Telegram на deleteMessage: для старых сообщений/без прав удаление может не сработать.
// - Для продакшена используйте внешний StateStore + распределённый лок при необходимости.
// ============================================================================
