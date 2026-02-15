---
order: 1
---

# AppIcon

Renders configurable icon from config path.

## Usage

```tsx
<AppIcon showKey="chat.showMessageIcon" iconKey="chat.messageIcon" />
<AppIcon showKey="sidebar.showIcon" iconKey="sidebar.icon" size={24} />
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `showKey` | `BooleanConfigKey` | Yes | Config key for show flag |
| `iconKey` | `StringConfigKey` | Yes | Config key for icon path |
| `size` | `20 \| 24` | No | Icon size (default: 20) |
| `className` | `string` | No | Additional CSS class |

Returns `null` if `showKey` is false or `iconKey` is empty.
