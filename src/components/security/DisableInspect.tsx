import { useEffect } from 'react';

const DisableInspect = () => {
  useEffect(() => {
    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable text selection (but allow in input fields)
    const handleSelectStart = (e: Event) => {
      const target = e.target as HTMLElement;
      // Allow selection in input fields, textareas, and contenteditable elements
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('[contenteditable="true"]')
      ) {
        return true;
      }
      e.preventDefault();
      return false;
    };

    // Disable drag
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
      return false;
    };

    // Disable keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+Shift+C (Inspect Element)
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+S (Save Page)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+P (Print)
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+A (Select All) - but allow in input fields
      const target = e.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.isContentEditable ||
                          target.closest('input') ||
                          target.closest('textarea') ||
                          target.closest('[contenteditable="true"]');

      if (e.ctrlKey && e.key === 'a' && !isInputField) {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+C (Copy) - but allow in input fields
      if (e.ctrlKey && e.key === 'c' && !isInputField) {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+V (Paste) - but allow in input fields
      if (e.ctrlKey && e.key === 'v' && !isInputField) {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+X (Cut) - but allow in input fields
      if (e.ctrlKey && e.key === 'x' && !isInputField) {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+Shift+P (Command Palette in DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+Shift+D (Disable cache in DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+Shift+K (Console in Firefox)
      if (e.ctrlKey && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        return false;
      }

      // Disable Ctrl+Shift+E (Network in DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        return false;
      }
    };

    // Disable copy event (but allow in input fields)
    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      // Allow copy in input fields, textareas, and contenteditable elements
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('[contenteditable="true"]')
      ) {
        return true;
      }
      e.preventDefault();
      e.clipboardData?.setData('text/plain', '');
      return false;
    };

    // Disable cut event (but allow in input fields)
    const handleCut = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      // Allow cut in input fields, textareas, and contenteditable elements
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('[contenteditable="true"]')
      ) {
        return true;
      }
      e.preventDefault();
      e.clipboardData?.setData('text/plain', '');
      return false;
    };

    // Disable paste event (but allow in input fields)
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      // Allow paste in input fields, textareas, and contenteditable elements
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('[contenteditable="true"]')
      ) {
        return true;
      }
      e.preventDefault();
      return false;
    };

    // Detect DevTools opening (multiple methods)
    let devToolsOpen = false;
    
    const detectDevTools = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      
      if (widthThreshold || heightThreshold) {
        if (!devToolsOpen) {
          devToolsOpen = true;
          // Clear console when DevTools is detected
          console.clear();
          // Redirect to home page
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
        }
      } else {
        devToolsOpen = false;
      }
    };

    // Monitor for DevTools
    const devToolsCheckInterval = setInterval(detectDevTools, 500);

    // Disable console methods
    const disableConsole = () => {
      const noop = () => {};
      const methods = ['log', 'debug', 'info', 'warn', 'error', 'assert', 'dir', 'dirxml', 'group', 'groupEnd', 'time', 'timeEnd', 'count', 'trace', 'profile', 'profileEnd'];
      
      methods.forEach((method) => {
        if ((console as any)[method]) {
          (console as any)[method] = noop;
        }
      });
    };

    // Disable debugger
    const disableDebugger = () => {
      const originalDebugger = window.Debug;
      Object.defineProperty(window, 'debugger', {
        get: () => originalDebugger,
        set: () => {},
        configurable: false
      });
    };

    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);

    // Disable console and debugger
    disableConsole();
    disableDebugger();

    // Text selection is already disabled via CSS

    // Disable drag
    document.body.setAttribute('draggable', 'false');
    document.body.ondragstart = () => false;

    // Cleanup on unmount
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      
      // Clear DevTools check interval
      if (devToolsCheckInterval) {
        clearInterval(devToolsCheckInterval);
      }
    };
  }, []);

  return null;
};

export default DisableInspect;

