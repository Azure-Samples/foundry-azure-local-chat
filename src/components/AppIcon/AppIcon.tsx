// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * AppIcon Component
 *
 * Simple icon component that renders an image from a config path.
 * Returns null if no icon path is provided or show flag is false.
 */
import { config } from "@/config/constants";
import type { TypedConfigOptions } from "@/config/constants.types";

type BooleanConfigKey = {
  [K in keyof TypedConfigOptions]: TypedConfigOptions[K] extends boolean ? K : never;
}[keyof TypedConfigOptions];

type StringConfigKey = {
  [K in keyof TypedConfigOptions]: TypedConfigOptions[K] extends string ? K : never;
}[keyof TypedConfigOptions];

interface AppIconProps {
  /** Config key for "show icon" boolean flag */
  showKey: BooleanConfigKey;
  /** Config key for icon path string */
  iconKey: StringConfigKey;
  size?: 20 | 24;
  className?: string;
}

/**
 * AppIcon - Renders icon from config path if enabled
 * 
 * Usage:
 *   <AppIcon showKey="sidebar.showIcon" iconKey="sidebar.icon" />
 *   <AppIcon showKey="chat.showMessageIcon" iconKey="chat.messageIcon" />
 */
export const AppIcon = ({ showKey, iconKey, size = 20, className }: AppIconProps) => {
  const shouldShow = config.isEnabled(showKey);
  const iconPath = config.get(iconKey);

  if (!shouldShow || !iconPath) {
    return null;
  }

  return (
    <img
      src={iconPath}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ display: "block" }}
    />
  );
};

export default AppIcon;
