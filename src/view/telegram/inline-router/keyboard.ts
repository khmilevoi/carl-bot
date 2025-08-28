import { Markup } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

import type { Button } from './types';

export function ensureRows<A>(
  buttons?: Array<Button<A> | Button<A>[]>
): Button<A>[][] {
  if (!buttons?.length) return [];
  const rows: Button<A>[][] = [];
  for (const button of buttons)
    rows.push((Array.isArray(button) ? button : [button]) as Button<A>[]);
  return rows;
}

export function buttonsEqual<A>(
  left: Button<A>[][],
  right: Button<A>[][]
): boolean {
  if (left.length !== right.length) return false;
  for (let rowIndex = 0; rowIndex < left.length; rowIndex++) {
    if (left[rowIndex].length !== right[rowIndex].length) return false;
    for (let colIndex = 0; colIndex < left[rowIndex].length; colIndex++) {
      if (
        left[rowIndex][colIndex].text !== right[rowIndex][colIndex].text ||
        left[rowIndex][colIndex].callback !== right[rowIndex][colIndex].callback
      )
        return false;
    }
  }
  return true;
}

export type KeyboardLabels = {
  backLabel: string;
  backCallbackData: string;
  cancelLabel: string;
  cancelCallbackData: string;
};

export function buildKeyboardMarkup<A>(
  rows: Button<A>[][],
  showBack: boolean,
  showCancel: boolean,
  labels: KeyboardLabels
): InlineKeyboardMarkup {
  const keyboardRows = rows.map((row) =>
    row.map((button) => Markup.button.callback(button.text, button.callback))
  );
  if (showBack || showCancel) {
    const extraRow: ReturnType<typeof Markup.button.callback>[] = [];
    if (showCancel)
      extraRow.push(
        Markup.button.callback(labels.cancelLabel, labels.cancelCallbackData)
      );
    if (showBack)
      extraRow.push(
        Markup.button.callback(labels.backLabel, labels.backCallbackData)
      );
    keyboardRows.push(extraRow);
  }
  return Markup.inlineKeyboard(keyboardRows).reply_markup;
}
