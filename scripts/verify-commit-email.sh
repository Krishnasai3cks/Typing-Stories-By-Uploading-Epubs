#!/bin/sh
# Allow commits only from the Krishnasai3cks GitHub identity.

is_allowed_email() {
  email=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')

  case "$email" in
    krishnasai3cks@gmail.com) return 0 ;;
    *+krishnasai3cks@users.noreply.github.com) return 0 ;;
    krishnasai3cks@users.noreply.github.com) return 0 ;;
  esac

  return 1
}

check_email() {
  label=$1
  email=$2

  if [ -z "$email" ]; then
    printf 'ERROR: %s email is not set.\n' "$label" >&2
    return 1
  fi

  if ! is_allowed_email "$email"; then
    printf 'ERROR: %s email "%s" is not allowed.\n' "$label" "$email" >&2
    printf 'Allowed: krishnasai3cks@gmail.com or *+Krishnasai3cks@users.noreply.github.com\n' >&2
    return 1
  fi

  return 0
}

if [ -n "${VERIFY_COMMIT:-}" ]; then
  author_email=$(git show -s --format='%ae' "$VERIFY_COMMIT")
  committer_email=$(git show -s --format='%ce' "$VERIFY_COMMIT")
else
  author_email=${GIT_AUTHOR_EMAIL:-$(git config --get user.email 2>/dev/null || true)}
  committer_email=${GIT_COMMITTER_EMAIL:-$(git config --get user.email 2>/dev/null || true)}
fi

check_email "Author" "$author_email" && check_email "Committer" "$committer_email"
