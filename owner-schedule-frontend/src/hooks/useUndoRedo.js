import { useState, useCallback, useEffect } from 'react';
import { useUndoShortcut, useRedoShortcut } from '../hooks/keyboardShortcuts.js';

/**
 * A custom hook to manage undo/redo history for application state.
 * @param {function} onAction - A callback function that is executed to perform
 * the 'undo' or 'redo' action. It receives the
 * action object as an argument.
 * @returns {{
 * commitAction: function,
 * undo: function,
 * redo: function,
 * canUndo: boolean,
 * canRedo: boolean
 * }}
 */
export const useUndoRedo = (onAction) => {
    const [undoHistory, setUndoHistory] = useState([]);
    const [redoHistory, setRedoHistory] = useState([]);

    const commitAction = useCallback((action) => {
        setUndoHistory(prevHistory => [...prevHistory, action]);
        setRedoHistory([]);
    }, []);

    const undo = useCallback(() => {
        if (undoHistory.length === 0) return;
        
        const lastAction = undoHistory[undoHistory.length - 1];
        setUndoHistory(prevHistory => prevHistory.slice(0, -1));
        setRedoHistory(prevHistory => [lastAction, ...prevHistory]);

        // We delegate the actual state-changing logic to the component that uses the hook.
        // This makes the hook more generic and reusable.
        onAction({ type: 'undo', action: lastAction });
    }, [undoHistory, onAction]);

    const redo = useCallback(() => {
        if (redoHistory.length === 0) return;

        const nextAction = redoHistory[0];
        setRedoHistory(prevHistory => prevHistory.slice(1));
        setUndoHistory(prevHistory => [...prevHistory, nextAction]);
        
        // Delegate the state-changing logic.
        onAction({ type: 'redo', action: nextAction });
    }, [redoHistory, onAction]);
    
    // Use your existing keyboard shortcut hooks to trigger the actions.
    useUndoShortcut(undo);
    useRedoShortcut(redo);

    return {
        commitAction,
        undo,
        redo,
        canUndo: undoHistory.length > 0,
        canRedo: redoHistory.length > 0,
    };
};