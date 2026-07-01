export default {
  rules: {
    // Theme toggles use the View Transitions API on documentElement directly;
    // React's <ViewTransition> is not available in this React version.
    "react-doctor/no-document-start-view-transition": "off",
  },
};
