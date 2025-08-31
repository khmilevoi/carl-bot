import type { Context } from 'telegraf';
import type {
  InlineKeyboardMarkup,
  Message,
} from 'telegraf/typings/core/types/typegram';

import type { ResolvedOptions } from './defaults';
import type {
  Button,
  ContextWithCallbackQuery,
  RenderMode,
  RouterState,
  RouteView,
} from './types';

export function createRenderer<A = unknown>(
  options: ResolvedOptions,
  getState: (ctx: Context) => Promise<RouterState>,
  setState: (ctx: Context, st: RouterState) => Promise<void>
): {
  render: (
    ctx: Context,
    view: RouteView<A> | undefined,
    inheritedBack: boolean,
    inheritedCancel: boolean
  ) => Promise<void>;
} {
  const rowsFrom = (
    buttons?: Array<Button<A> | Button<A>[]>
  ): Button<unknown>[][] => {
    if (!buttons?.length) return [];
    const rows: Button<unknown>[][] = [];
    for (const b of buttons)
      rows.push((Array.isArray(b) ? b : [b]) as Button<unknown>[]);
    return rows;
  };
  const buttonsEqual = (
    l: Button<unknown>[][],
    r: Button<unknown>[][]
  ): boolean => {
    if (l.length !== r.length) return false;
    for (let i = 0; i < l.length; i++) {
      if (l[i].length !== r[i].length) return false;
      for (let j = 0; j < l[i].length; j++) {
        if (
          l[i][j].text !== r[i][j].text ||
          l[i][j].callback !== r[i][j].callback
        )
          return false;
      }
    }
    return true;
  };
  const keyboard = (
    rows: Button<unknown>[][],
    showBack: boolean,
    showCancel: boolean
  ): InlineKeyboardMarkup => {
    const inline_keyboard = rows.map((row) =>
      row.map((b) => ({ text: b.text, callback_data: b.callback }))
    );
    if (showBack || showCancel) {
      const extra: Array<{ text: string; callback_data: string }> = [];
      if (showCancel)
        extra.push({
          text: options.cancelLabel,
          callback_data: options.cancelCallbackData,
        });
      if (showBack)
        extra.push({
          text: options.backLabel,
          callback_data: options.backCallbackData,
        });
      inline_keyboard.push(extra);
    }
    return { inline_keyboard } as unknown as InlineKeyboardMarkup;
  };

  async function pruneOverflow(ctx: Context, st: RouterState): Promise<void> {
    const limit = options.maxMessages;
    const overflow = Math.max(0, st.messages.length - limit);
    if (overflow <= 0) return;
    const drop = st.messages.slice(0, overflow);
    for (const m of drop) {
      try {
        await ctx.deleteMessage(m.messageId);
      } catch {
        /* noop */
      }
    }
    st.messages = st.messages.slice(overflow);
    await setState(ctx, st);
  }

  async function render(
    ctx: Context,
    view: RouteView<A> | undefined,
    inheritedBack: boolean,
    inheritedCancel: boolean
  ): Promise<void> {
    const st = await getState(ctx);
    const rows = rowsFrom(view?.buttons);
    const showBack =
      typeof view?.showBack === 'boolean' ? view.showBack : inheritedBack;
    const showCancel =
      typeof view?.showCancel === 'boolean' ? view.showCancel : inheritedCancel;
    const reply_markup = keyboard(rows, showBack, showCancel);
    const mode: RenderMode = (view?.renderMode ??
      options.renderMode) as RenderMode;
    const mid = (ctx as ContextWithCallbackQuery).callbackQuery?.message
      ?.message_id;
    const remember = async (messageId: number): Promise<void> => {
      const entry = {
        messageId,
        text: view?.text ?? '',
        buttons: rows as Button<unknown>[][],
        showBack,
        showCancel,
      };
      const i = st.messages.findIndex((m) => m.messageId === messageId);
      if (i >= 0) st.messages[i] = entry;
      else st.messages.push(entry);
      await setState(ctx, st);
      await pruneOverflow(ctx, st);
    };

    if (mode === 'append') {
      const sent = await ctx.reply(view?.text ?? '', {
        reply_markup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const id = (sent as Message).message_id;
      if (id) await remember(id);
      return;
    }

    if (mode === 'replace') {
      const target = mid ?? st.messages[st.messages.length - 1]?.messageId;
      if (target) {
        try {
          await ctx.deleteMessage(target);
          st.messages = st.messages.filter((m) => m.messageId !== target);
          await setState(ctx, st);
        } catch {
          /* noop */
        }
      }
      const sent = await ctx.reply(view?.text ?? '', {
        reply_markup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const id = (sent as Message).message_id;
      if (id) await remember(id);
      return;
    }

    if (mode === 'smart' && mid) {
      const prev = st.messages.find((m) => m.messageId === mid);
      if (
        prev &&
        prev.text === (view?.text ?? '') &&
        buttonsEqual(prev.buttons, rows) &&
        prev.showBack === showBack &&
        prev.showCancel === showCancel
      )
        return;
      try {
        await ctx.editMessageText(view?.text ?? '', {
          reply_markup,
          link_preview_options: { is_disabled: view?.disablePreview ?? true },
        });
        await remember(mid);
        return;
      } catch {
        /* noop */
      }
      if (options.onEditFail === 'replace') {
        try {
          await ctx.deleteMessage(mid);
          st.messages = st.messages.filter((m) => m.messageId !== mid);
          await setState(ctx, st);
        } catch {
          /* noop */
        }
      } else if (options.onEditFail === 'ignore') {
        return;
      }
      const sent = await ctx.reply(view?.text ?? '', {
        reply_markup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const id = (sent as Message).message_id;
      if (id) await remember(id);
      return;
    }

    if (mode === 'edit' && mid) {
      try {
        await ctx.editMessageText(view?.text ?? '', {
          reply_markup,
          link_preview_options: { is_disabled: view?.disablePreview ?? true },
        });
        await remember(mid);
        return;
      } catch {
        /* noop */
      }
      if (options.onEditFail === 'replace') {
        try {
          await ctx.deleteMessage(mid);
          st.messages = st.messages.filter((m) => m.messageId !== mid);
          await setState(ctx, st);
        } catch {
          /* noop */
        }
      } else if (options.onEditFail === 'ignore') {
        return;
      }
      const sent = await ctx.reply(view?.text ?? '', {
        reply_markup,
        link_preview_options: { is_disabled: view?.disablePreview ?? true },
      });
      const id = (sent as Message).message_id;
      if (id) await remember(id);
      return;
    }

    const sent = await ctx.reply(view?.text ?? '', {
      reply_markup,
      link_preview_options: { is_disabled: view?.disablePreview ?? true },
    });
    const id = (sent as Message).message_id;
    if (id) await remember(id);
  }

  return { render };
}
