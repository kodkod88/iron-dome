/**
 * UIButtonFactory — Phaser-aware.
 * Single source of truth for button layout: background + label share the same
 * container so text is always pixel-perfect centred regardless of label length.
 *
 * Usage
 * ─────
 *   const btn = createButton(scene, 'RESUME  [ESC]', x, y, () => onResume());
 *   parentContainer.add(btn);     // or leave in scene root
 *   btn.setVisible(false);        // containers support all standard methods
 *   btn.label.setText('PAUSED');  // update label at any time
 */

export function createButton(scene, label, x, y, onClick) {
  const container = scene.add.container(x, y);

  const width  = 160;
  const height = 44;

  // Background — Rectangle supports setFillStyle / setStrokeStyle directly
  const bg = scene.add.rectangle(0, 0, width, height, 0x0f1914, 0.75)
    .setStrokeStyle(1.5, 0x50ff8c, 0.6);

  // Label — origin (0.5, 0.5) centres it on the container origin
  const text = scene.add.text(0, 0, label, {
    fontFamily: 'Arial',
    fontSize:   '16px',
    fontStyle:  '600',
    color:      '#8cffb4',
    align:      'center',
  }).setOrigin(0.5, 0.5);

  container.add([bg, text]);

  // Interaction on the background so the hit area matches the visible rect
  bg.setInteractive({ useHandCursor: true });

  bg.on('pointerover', () => {
    bg.setFillStyle(0x19281e, 0.85);
    bg.setStrokeStyle(1.5, 0x78ffb4, 0.9);
  });
  bg.on('pointerout', () => {
    bg.setFillStyle(0x0f1914, 0.75);
    bg.setStrokeStyle(1.5, 0x50ff8c, 0.6);
  });
  bg.on('pointerdown', () => {
    bg.setFillStyle(0x0a120f, 0.9);
    onClick();
  });

  // Expose label text object so callers can call setText() for dynamic labels
  container.label = text;

  return container;
}
