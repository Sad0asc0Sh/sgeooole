/**
 * Ant Design theme — single source of truth for the panel's component
 * styling. Values mirror theme/tokens.css; change the palette in one
 * place (tokens.css for custom CSS, here for antd components) and the
 * whole panel follows.
 *
 * Design intent: an operations panel, not a marketing page. Surfaces
 * are white on a warm canvas and separated by hairlines rather than
 * heavy shadow. The saffron brand colour is reserved for things you can
 * *act on* — primary buttons, selected rows, focus. It is never used
 * as decoration, so it always means "this is the live control".
 */

const BRAND = '#b45309'
const BRAND_HOVER = '#c2620b'
const BRAND_ACTIVE = '#8f4209'
const BRAND_TINT = '#fdf4e3'

const INK_900 = '#1c1917'
const INK_800 = '#292524'
const INK_700 = '#44403c'
const INK_600 = '#57534e'
const INK_500 = '#6b625c'
const INK_400 = '#8a817a'
const INK_300 = '#b5aea6'

const LINE = '#e2ddd6'
const LINE_SOFT = '#efece7'
const LINE_STRONG = '#d6cfc6'
const CANVAS = '#f2f1ef'
const INSET = '#f7f6f4'
const SUNKEN = '#faf9f7'

const FONT =
  "'Vazirmatn', 'IRANSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif"

const SHADOW_XS = '0 1px 2px rgba(28, 25, 23, 0.05)'
const SHADOW_SM =
  '0 1px 2px rgba(28, 25, 23, 0.05), 0 2px 6px rgba(28, 25, 23, 0.04)'
const SHADOW_MD =
  '0 4px 12px rgba(28, 25, 23, 0.07), 0 1px 3px rgba(28, 25, 23, 0.05)'
const SHADOW_LG =
  '0 12px 32px rgba(28, 25, 23, 0.12), 0 2px 8px rgba(28, 25, 23, 0.06)'

export const adminTheme = {
  token: {
    colorPrimary: BRAND,
    colorPrimaryHover: BRAND_HOVER,
    colorPrimaryActive: BRAND_ACTIVE,
    colorPrimaryBg: BRAND_TINT,
    colorPrimaryBgHover: '#fae8c4',
    colorPrimaryText: BRAND,

    colorInfo: '#0e7490',
    colorSuccess: '#0f6b33',
    colorWarning: '#8a6200',
    colorError: '#b3261e',

    colorLink: BRAND,
    colorLinkHover: BRAND_HOVER,

    colorTextBase: INK_900,
    colorText: INK_900,
    colorTextSecondary: INK_500,
    colorTextTertiary: INK_400,
    colorTextQuaternary: INK_400,
    colorTextPlaceholder: INK_400,
    colorTextDisabled: INK_300,
    colorTextDescription: INK_500,
    colorTextHeading: INK_900,
    colorTextLabel: INK_700,

    colorBorder: LINE_STRONG,
    colorBorderSecondary: LINE,
    colorSplit: LINE_SOFT,

    colorBgLayout: CANVAS,
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgSpotlight: '#2c2825',
    colorBgMask: 'rgba(28, 25, 23, 0.45)',
    colorFillAlter: SUNKEN,
    colorFillQuaternary: SUNKEN,
    colorFillTertiary: INSET,
    colorFillSecondary: INSET,
    colorFill: '#f0eeeb',

    // One radius family, expressed through the scale antd expects.
    borderRadius: 8,
    borderRadiusSM: 6,
    borderRadiusXS: 4,
    borderRadiusLG: 12,
    borderRadiusMD: 10,

    fontSize: 13.5,
    fontSizeSM: 12.5,
    fontSizeHeading1: 26,
    fontSizeHeading2: 18,
    fontSizeHeading3: 15,
    fontSizeLG: 15,
    fontWeightStrong: 700,
    fontFamily: FONT,
    lineHeight: 1.65,

    controlHeight: 36,
    controlHeightSM: 30,
    controlHeightLG: 42,

    boxShadow: SHADOW_SM,
    boxShadowSecondary: SHADOW_MD,
    boxShadowTertiary: SHADOW_LG,

    wireframe: false,
    motionDurationMid: '0.18s',
    motionDurationSlow: '0.28s',
    motionEaseInOut: 'cubic-bezier(0.32, 0.72, 0.3, 1)',
  },

  components: {
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 60,
      headerPadding: '0 24px',
      siderBg: '#1c1917',
      bodyBg: CANVAS,
    },

    Menu: {
      // The dark rail is fully owned by MainLayout.css; these values
      // only need to stop antd from painting its own opinion.
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkItemSelectedBg: BRAND,
      darkItemSelectedColor: '#ffffff',
      darkItemColor: '#b5aea6',
      darkItemHoverColor: '#ffffff',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.07)',
      itemBorderRadius: 8,
      itemHeight: 38,
      iconSize: 16,
      collapsedIconSize: 17,
    },

    Table: {
      headerBg: INSET,
      headerColor: INK_700,
      headerSplitColor: 'transparent',
      bodySortBg: INSET,
      rowHoverBg: SUNKEN,
      borderColor: LINE_SOFT,
      cellPaddingBlockMD: 11,
      cellPaddingInlineMD: 14,
      headerBorderRadius: 8,
      footerBg: 'transparent',
      fontSize: 13.5,
    },

    Card: {
      headerBg: 'transparent',
      headerFontSize: 15,
      paddingLG: 20,
      colorBorderSecondary: LINE,
    },

    Button: {
      controlHeight: 36,
      fontWeight: 500,
      borderRadius: 8,
      paddingInline: 15,
      // Brand shadow is kept very light — the fill already says "primary".
      primaryShadow: '0 1px 2px rgba(180, 83, 9, 0.22)',
      defaultShadow: 'none',
      dangerShadow: 'none',
      // Text buttons in toolbars read better without a border colour clash.
      textHoverBg: INSET,
      defaultBg: '#ffffff',
      defaultBorderColor: LINE_STRONG,
      defaultBorderHoverColor: BRAND,
    },

    Input: {
      controlHeight: 36,
      activeBorderColor: BRAND,
      hoverBorderColor: '#b9b1a8',
      activeShadow: '0 0 0 3px rgba(180, 83, 9, 0.10)',
      paddingInline: 12,
    },

    InputNumber: {
      activeBorderColor: BRAND,
      hoverBorderColor: '#b9b1a8',
      activeShadow: '0 0 0 3px rgba(180, 83, 9, 0.10)',
    },

    Select: {
      optionSelectedBg: BRAND_TINT,
      optionSelectedColor: BRAND,
      optionActiveBg: INSET,
      activeOutlineColor: 'rgba(180, 83, 9, 0.10)',
    },

    DatePicker: {
      activeBorderColor: BRAND,
      hoverBorderColor: '#b9b1a8',
      activeShadow: '0 0 0 3px rgba(180, 83, 9, 0.10)',
    },

    Modal: {
      borderRadiusLG: 14,
      titleFontSize: 16,
      headerBg: '#ffffff',
      contentBg: '#ffffff',
      titleColor: INK_900,
    },

    Drawer: {
      colorBgElevated: '#ffffff',
    },

    Tabs: {
      itemColor: INK_500,
      itemHoverColor: INK_900,
      itemSelectedColor: BRAND,
      inkBarColor: BRAND,
      titleFontSize: 14,
      horizontalItemGutter: 22,
      horizontalMargin: '0 0 16px 0',
    },

    Tag: {
      defaultBg: INSET,
      defaultColor: INK_700,
      borderRadiusSM: 6,
    },

    Segmented: {
      itemSelectedBg: '#ffffff',
      itemSelectedColor: BRAND,
      trackBg: SUNKEN,
    },

    Pagination: {
      itemSize: 32,
      itemActiveBg: BRAND,
    },

    Descriptions: {
      labelBg: SUNKEN,
      titleMarginBottom: 12,
    },

    Statistic: {
      contentFontSize: 24,
      titleFontSize: 13,
    },

    Alert: {
      borderRadiusLG: 10,
      withDescriptionPadding: '14px 16px',
    },

    Empty: {
      colorTextDescription: INK_400,
    },

    Tooltip: {
      colorBgSpotlight: '#2c2825',
      borderRadius: 8,
    },

    Popover: {
      borderRadiusLG: 12,
    },

    Dropdown: {
      paddingBlock: 6,
    },

    Form: {
      labelColor: INK_700,
      labelFontSize: 13,
      verticalLabelPadding: '0 0 6px',
      itemMarginBottom: 18,
    },

    Tree: {
      nodeHoverBg: SUNKEN,
      nodeSelectedBg: BRAND_TINT,
      directoryNodeSelectedColor: BRAND,
      titleHeight: 34,
    },

    Switch: {
      colorPrimary: BRAND,
      colorPrimaryHover: BRAND_HOVER,
    },

    Progress: {
      defaultColor: BRAND,
      remainingColor: INSET,
    },

    Badge: {
      colorError: '#b3261e',
      textFontSizeSM: 11,
    },

    Breadcrumb: {
      itemColor: INK_500,
      lastItemColor: INK_800,
      separatorColor: INK_300,
    },
  },
}

export default adminTheme
