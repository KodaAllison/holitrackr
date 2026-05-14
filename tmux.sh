#!/bin/bash

SESSION="holitrackr"
DIR="/mnt/c/Users/Koda/Code/holitrackr"
CLAUDE="/mnt/c/Program Files/nodejs/claude"

tmux kill-session -t $SESSION 2>/dev/null
tmux new-session -d -s $SESSION -c $DIR

# Layout: 3 Claude panes (top), dev server + git shell (bottom)
tmux split-window -v -p 30 -t $SESSION        # bottom strip
tmux split-window -h -p 50 -t $SESSION:0.1    # split bottom into dev + git
tmux split-window -h -p 67 -t $SESSION:0.0    # split top into 3 panes

# Claude panes (top row)
tmux send-keys -t $SESSION:0.0 "cd $DIR && \"$CLAUDE\"" Enter
tmux send-keys -t $SESSION:0.2 "cd $DIR && \"$CLAUDE\"" Enter
tmux send-keys -t $SESSION:0.3 "cd $DIR && \"$CLAUDE\"" Enter

# Dev server (bottom-left)
tmux send-keys -t $SESSION:0.1 "cd $DIR && npm run dev" Enter

# Git shell (bottom-right)
tmux send-keys -t $SESSION:0.4 "cd $DIR" Enter

tmux select-pane -t $SESSION:0.0
tmux attach-session -t $SESSION
