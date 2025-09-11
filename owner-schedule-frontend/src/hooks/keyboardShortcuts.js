import { useEffect } from 'react';

/**
 * A custom hook to listen for the Ctrl/Cmd + U keyboard shortcut
 * and execute a provided callback function.
 * @param {function} onUndo - The function to call when the shortcut is triggered.
 */
export const useUndoShortcut = (onUndo) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Prevent the default browser behavior (e.g., source view)
      if ((event.ctrlKey || event.metaKey) && event.key === 'u') { 
        event.preventDefault();
        onUndo();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onUndo]);
};

/**
 * A custom hook to listen for the Ctrl/Cmd + R keyboard shortcut
 * and execute a provided callback function.
 * @param {function} onRedo - The function to call when the shortcut is triggered.
 */
export const useRedoShortcut = (onRedo) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // The shortcut is Ctrl + R on all platforms
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        onRedo();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onRedo]);
};