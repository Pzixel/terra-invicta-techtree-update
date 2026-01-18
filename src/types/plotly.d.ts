declare module 'plotly.js-dist-min' {
  import Plotly from 'plotly.js';
  export default Plotly;
}

declare module 'react-plotly.js/factory' {
  import Plotly from 'plotly.js';
  import { ComponentType } from 'react';
  export default function createPlotlyComponent(plotly: typeof Plotly): ComponentType<any>;
}
