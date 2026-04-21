import { deepCloneState } from './utils';

export class HistoryManager {
  constructor(limit = 100) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }

  push(before, after, label = 'Action') {
    this.undoStack.push({
      before: deepCloneState(before),
      after: deepCloneState(after),
      label,
    });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo(currentState) {
    if (!this.canUndo()) return null;
    const action = this.undoStack.pop();
    this.redoStack.push({
      before: deepCloneState(action.before),
      after: deepCloneState(currentState),
      label: action.label,
    });
    return deepCloneState(action.before);
  }

  redo(currentState) {
    if (!this.canRedo()) return null;
    const action = this.redoStack.pop();
    this.undoStack.push({
      before: deepCloneState(currentState),
      after: deepCloneState(action.after),
      label: action.label,
    });
    return deepCloneState(action.after);
  }

  reset() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
