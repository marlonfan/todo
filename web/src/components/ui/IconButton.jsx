import React from 'react';
import { Button } from './Button';

// 图标按钮（阶段 2）：复用 Button size="icon"，统一 .md-icon-btn / .prompt-card-tool /
// .task-ai-close / .prompt-dialog-close 等多套尺寸/圆角不一致的实现。
// label 必填（作为 aria-label）。
export const IconButton = React.forwardRef(({ label, ...props }, ref) => (
  <Button ref={ref} size="icon" aria-label={label} {...props} />
));
IconButton.displayName = 'IconButton';
