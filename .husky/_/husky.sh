#!/bin/sh
if [ -z "$husky_skip_init" ]; then
  debug () {
    [ "$HUSKY_DEBUG" = "1" ] && echo "husky (debug) - $*"
  }
  readonly hook_name="$(basename "$0")"
  debug "starting $hook_name..."
  if [ -f ~/.huskyrc ]; then
    debug "found ~/.huskyrc"
    . ~/.huskyrc
  fi
  export PATH="$PATH:$(npm bin)"
  husky_skip_init=1
  [ -f ~/.huskyrc.local ] && . ~/.huskyrc.local
  debug "$hook_name finished"
fi
