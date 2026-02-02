#!/bin/bash
# ZERO Worktree Aliases — Boris Cherny parallel development pattern
# Source this file in your .bashrc or .zshrc:
#   source ~/Documents/sol-paper-ext-beta/.claude/worktree-aliases.sh
#
# Usage: Spin up 3-5 worktrees, each running its own Claude session in parallel.
#   za  -> switches to worktree A (feature work)
#   zb  -> switches to worktree B (bug fixes)
#   zc  -> switches to worktree C (experiments)
#   zn  -> creates a new named worktree
#   zl  -> lists all worktrees
#   zd  -> removes a worktree

ZERO_ROOT="$HOME/Documents/sol-paper-ext-beta"
ZERO_TREES="$HOME/Documents/zero-worktrees"

# Quick-switch aliases
alias za='cd "$ZERO_TREES/tree-a" 2>/dev/null || echo "Worktree A not created. Run: zn tree-a feature/my-branch"'
alias zb='cd "$ZERO_TREES/tree-b" 2>/dev/null || echo "Worktree B not created. Run: zn tree-b fix/my-branch"'
alias zc='cd "$ZERO_TREES/tree-c" 2>/dev/null || echo "Worktree C not created. Run: zn tree-c exp/my-branch"'

# Create a new worktree: zn <tree-name> <branch-name>
zn() {
  if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: zn <tree-name> <branch-name>"
    echo "Example: zn tree-a feature/new-hud"
    return 1
  fi
  mkdir -p "$ZERO_TREES"
  git -C "$ZERO_ROOT" worktree add "$ZERO_TREES/$1" -b "$2"
  echo "Worktree created at $ZERO_TREES/$1 on branch $2"
  echo "Switch to it with: cd $ZERO_TREES/$1"
}

# List all worktrees
alias zl='git -C "$ZERO_ROOT" worktree list'

# Remove a worktree: zd <tree-name>
zd() {
  if [ -z "$1" ]; then
    echo "Usage: zd <tree-name>"
    return 1
  fi
  git -C "$ZERO_ROOT" worktree remove "$ZERO_TREES/$1"
  echo "Worktree $1 removed"
}

# Open Claude in a worktree: zcc <tree-name>
zcc() {
  local tree="${1:-tree-a}"
  local dir="$ZERO_TREES/$tree"
  if [ -d "$dir" ]; then
    cd "$dir" && claude
  else
    echo "Worktree $tree not found. Create it with: zn $tree <branch-name>"
  fi
}

echo "ZERO worktree aliases loaded. Commands: za, zb, zc, zn, zl, zd, zcc"
