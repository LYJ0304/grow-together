import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

type Viewport = { height: number; offsetTop: number };

export function useChatKeyboard() {
  const [visible, setVisible] = useState(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      setVisible(Keyboard.isVisible());
      const show = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        () => setVisible(true),
      );
      const hide = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
        () => setVisible(false),
      );
      return () => {
        show.remove();
        hide.remove();
      };
    }

    const visual = window.visualViewport;
    if (!visual) return;
    let frame = 0;
    const update = () => {
      const field = document.activeElement;
      const editing =
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLInputElement;
      // Browser chrome and zoom also resize the visual viewport. Require a
      // focused field, touch input, unchanged width and a keyboard-sized inset.
      const open =
        editing &&
        window.matchMedia('(pointer: coarse)').matches &&
        Math.abs(visual.scale - 1) < 0.01 &&
        Math.abs(visual.width - document.documentElement.clientWidth) < 2 &&
        window.innerHeight - visual.height - visual.offsetTop > 160;
      setVisible(open);
      setViewport(
        open ? { height: visual.height, offsetTop: visual.offsetTop } : null,
      );
    };
    const focusChanged = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    visual.addEventListener('resize', update);
    visual.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', focusChanged);
    document.addEventListener('focusout', focusChanged);
    update();
    return () => {
      cancelAnimationFrame(frame);
      visual.removeEventListener('resize', update);
      visual.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', focusChanged);
      document.removeEventListener('focusout', focusChanged);
    };
  }, []);

  return { visible, viewport };
}
