import * as React from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ModifiedCartesianChartProps, HorizontalBarChartWithAxisDataPoint, HeatMapChartDataPoint } from '../../index';
import { useCartesianChartStyles } from './useCartesianChartStyles.styles';
import { select as d3Select } from 'd3-selection';
import {
  createNumericXAxis,
  createStringXAxis,
  IAxisData,
  getDomainNRangeValues,
  createDateXAxis,
  createYAxis,
  createStringYAxis,
  IMargins,
  getMinMaxOfYAxis,
  XAxisTypes,
  YAxisType,
  createWrapOfXLabels,
  rotateXAxisLabels,
  calculateLongestLabelWidth,
  createYAxisLabels,
  ChartTypes,
  wrapContent,
  useRtl,
  truncateString,
  tooltipOfAxislabels,
} from '../../utilities/index';
import { useId } from '@fluentui/react-utilities';
import { SVGTooltipText } from '../../utilities/SVGTooltipText';
import { ChartPopover } from './ChartPopover';
import { useFocusableGroup, useArrowNavigationGroup } from '@fluentui/react-tabster';

/**
 * Cartesian Chart component
 * {@docCategory CartesianChart}
 */
export const CartesianChart: React.FunctionComponent<ModifiedCartesianChartProps> = React.forwardRef<
  HTMLDivElement,
  ModifiedCartesianChartProps
>((props, forwardedRef) => {
  const chartContainer = React.useRef<HTMLDivElement>();
  let legendContainer: HTMLDivElement;
  const minLegendContainerHeight: number = 40;
  const xAxisElement = React.useRef<SVGSVGElement>();
  const yAxisElement = React.useRef<SVGSVGElement>();
  const yAxisElementSecondary = React.useRef<SVGSVGElement>();
  let margins: IMargins;
  const idForGraph: string = 'chart_';
  let _reqID: number;
  const _useRtl: boolean = useRtl();
  let _tickValues: (string | number)[];
  const titleMargin: number = 8;
  const _isFirstRender = React.useRef<boolean>(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let _xScale: any;
  let isIntegralDataset: boolean = true;
  let _tooltipId: string = useId('tooltip_');

  const [containerWidth, setContainerWidth] = React.useState<number>(0);
  const [containerHeight, setContainerHeight] = React.useState<number>(0);
  const [isRemoveValCalculated, setIsRemoveValCalculated] = React.useState<boolean>(true);
  const [removalValueForTextTuncate, setRemovalValueForTextTuncate] = React.useState<number>(0);
  const [startFromX, setStartFromX] = React.useState<number>(0);
  const [prevProps, setPrevProps] = React.useState<ModifiedCartesianChartProps | null>(null);

  const chartTypesToCheck = [ChartTypes.HorizontalBarChartWithAxis, ChartTypes.HeatMapChart];
  /**
   * In RTL mode, Only graph will be rendered left/right. We need to provide left and right margins manually.
   * So that, in RTL, left margins becomes right margins and viceversa.
   * As graph needs to be drawn perfecty, these values consider as default values.
   * Same margins using for all other cartesian charts. Can be accessible through 'getMargins' call back method.
   */
  // eslint-disable-next-line prefer-const
  margins = {
    top: props.margins?.top ?? 20,
    bottom: props.margins?.bottom ?? 35,
    right: _useRtl ? props.margins?.left ?? 40 : props.margins?.right ?? props?.secondaryYScaleOptions ? 40 : 20,
    left: _useRtl ? (props.margins?.right ?? props?.secondaryYScaleOptions ? 40 : 20) : props.margins?.left ?? 40,
  };
  if (props.xAxisTitle !== undefined && props.xAxisTitle !== '') {
    margins.bottom! = props.margins?.bottom ?? 55;
  }
  if (props.yAxisTitle !== undefined && props.yAxisTitle !== '') {
    margins.left! = _useRtl
      ? props.margins?.right ?? props?.secondaryYAxistitle
        ? 80
        : 40
      : props.margins?.left ?? 60;
    margins.right! = _useRtl ? props.margins?.left ?? 60 : props.margins?.right ?? props?.secondaryYAxistitle ? 80 : 40;
  }

  const classes = useCartesianChartStyles(props);
  const focusAttributes = useFocusableGroup();
  const arrowAttributes = useArrowNavigationGroup({ axis: 'horizontal' });
  // ComponentdidMount and Componentwillunmount logic
  React.useEffect(() => {
    _fitParentContainer();
    if (props !== null) {
      setPrevProps(props);
    }
    if (chartTypesToCheck.includes(props.chartType) && props.showYAxisLables && yAxisElement) {
      const maxYAxisLabelLength = calculateMaxYAxisLabelLength(props.chartType, props.points, classes.yAxis!);
      if (startFromX !== maxYAxisLabelLength) {
        setStartFromX(maxYAxisLabelLength);
      }
    } else if (startFromX !== 0) {
      setStartFromX(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    isIntegralDataset = !props.points.some((point: { y: number }) => point.y % 1 !== 0);
    return () => {
      cancelAnimationFrame(_reqID);
    };
  }, [props]);

  // ComponentDidUpdate logic
  React.useEffect(() => {
    if (prevProps) {
      if (prevProps.height !== props.height || prevProps.width !== props.width) {
        _fitParentContainer();
      }
    }
    if (chartTypesToCheck.includes(props.chartType) && props.showYAxisLables && yAxisElement) {
      const maxYAxisLabelLength = calculateMaxYAxisLabelLength(props.chartType, props.points, classes.yAxis!);
      if (startFromX !== maxYAxisLabelLength) {
        setStartFromX(maxYAxisLabelLength);
      }
    } else if (startFromX !== 0) {
      setStartFromX(0);
    }
    if (prevProps !== null && prevProps.points !== props.points) {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      isIntegralDataset = !props.points.some((point: { y: number }) => point.y % 1 !== 0);
    }
  }, [props, prevProps]);

  React.useEffect(() => {
    if (!props.wrapXAxisLables && props.rotateXAxisLables && props.xAxisType! === XAxisTypes.StringAxis) {
      const rotateLabelProps = {
        node: xAxisElement.current!,
        xAxis: _xScale,
      };
      const rotatedHeight = rotateXAxisLabels(rotateLabelProps);

      if (
        isRemoveValCalculated &&
        removalValueForTextTuncate !== rotatedHeight! + margins.bottom! &&
        rotatedHeight! > 0
      ) {
        setRemovalValueForTextTuncate(rotatedHeight! + margins.bottom!);
        setIsRemoveValCalculated(false);
      }
    }
  });

  React.useImperativeHandle(
    props.componentRef,
    () => ({
      chartContainer: chartContainer.current ?? null,
    }),
    [],
  );

  /**
   * Dedicated function to return the Callout JSX Element , which can further be used to only call this when
   * only the calloutprops and charthover props changes.
   * @param calloutProps
   * @param chartHoverProps
   * @returns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function _generateCallout(calloutProps: any): JSX.Element {
    return <ChartPopover {...calloutProps} />;
  }

  function calculateMaxYAxisLabelLength(
    chartType: ChartTypes,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    points: any[],
    className: string,
  ): number {
    const formatTickLabel = (str: string) => {
      if (props.showYAxisLablesTooltip) {
        return truncateString(str, props.noOfCharsToTruncate || 4);
      }

      return str;
    };
    if (chartType === ChartTypes.HeatMapChart) {
      return calculateLongestLabelWidth(
        points[0]?.data?.map((point: HeatMapChartDataPoint) => formatTickLabel(`${point.y}`)),
        `.${className} text`,
      );
    } else {
      return calculateLongestLabelWidth(
        points?.map((point: HorizontalBarChartWithAxisDataPoint) => formatTickLabel(`${point.y}`)),
        `.${className} text`,
      );
    }
  }

  const {
    calloutProps,
    points,
    chartType,
    svgProps,
    culture,
    dateLocalizeOptions,
    timeFormatLocale,
    customDateTimeFormatter,
  } = props;
  if (props.parentRef) {
    _fitParentContainer();
  }
  const margin = { ...margins };
  if (chartTypesToCheck.includes(props.chartType)) {
    if (!_useRtl) {
      margin.left! += startFromX;
    } else {
      margin.right! += startFromX;
    }
  }
  // Callback for margins to the chart
  props.getmargins && props.getmargins(margin);

  let callout: JSX.Element | null = null;

  let children = null;
  if ((props.enableFirstRenderOptimization && chartContainer.current) || !props.enableFirstRenderOptimization) {
    _isFirstRender.current = false;
    const XAxisParams = {
      domainNRangeValues: props.getDomainNRangeValues
        ? props.getDomainNRangeValues(
            points,
            props.getDomainMargins ? props.getDomainMargins(containerWidth) : margins,
            containerWidth,
            chartType,
            _useRtl,
            props.xAxisType,
            props.barwidth!,
            props.tickValues!,
            // This is only used for Horizontal Bar Chart with Axis for y as string axis
            startFromX,
          )
        : getDomainNRangeValues(
            points,
            props.getDomainMargins ? props.getDomainMargins(containerWidth) : margins,
            containerWidth,
            chartType,
            _useRtl,
            props.xAxisType,
            props.barwidth!,
            props.tickValues!,
            // This is only used for Horizontal Bar Chart with Axis for y as string axis
            startFromX,
          ),
      containerHeight: containerHeight - removalValueForTextTuncate!,
      margins: margins,
      xAxisElement: xAxisElement.current!,
      showRoundOffXTickValues: true,
      xAxisCount: props.xAxisTickCount,
      xAxistickSize: props.xAxistickSize,
      tickPadding: props.tickPadding || props.showXAxisLablesTooltip ? 5 : 10,
      xAxisPadding: props.xAxisPadding,
      xAxisInnerPadding: props.xAxisInnerPadding,
      xAxisOuterPadding: props.xAxisOuterPadding,
      containerWidth: containerWidth,
      hideTickOverlap:
        props.hideTickOverlap && !props.rotateXAxisLables && !props.showXAxisLablesTooltip && !props.wrapXAxisLables,
    };

    const YAxisParams = {
      margins: props.getYDomainMargins ? props.getYDomainMargins(containerHeight) : margins,
      containerWidth: containerWidth,
      containerHeight: containerHeight - removalValueForTextTuncate!,
      yAxisElement: yAxisElement.current,
      yAxisTickFormat: props.yAxisTickFormat!,
      yAxisTickCount: props.yAxisTickCount!,
      yMinValue: props.yMinValue || 0,
      yMaxValue: props.yMaxValue || 0,
      tickPadding: props.showYAxisLablesTooltip ? 15 : 10,
      maxOfYVal: props.maxOfYVal,
      yMinMaxValues: props.getMinMaxOfYAxis
        ? props.getMinMaxOfYAxis(points, props.yAxisType)
        : getMinMaxOfYAxis(points, chartType, props.yAxisType),
      // please note these padding default values must be consistent in here
      // and the parent chart(HBWA/Vertical etc..) for more details refer example
      // http://using-d3js.com/04_07_ordinal_scales.html
      yAxisPadding: props.yAxisPadding || 0,
    };
    /**
     * These scales used for 2 purposes.
     * 1. To create x and y axis
     * 2. To draw the graph.
     * For area/line chart using same scales. For other charts, creating their own scales to draw the graph.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let xScale: any;
    let tickValues: (string | number)[];
    switch (props.xAxisType!) {
      case XAxisTypes.NumericAxis:
        ({ xScale, tickValues } = createNumericXAxis(XAxisParams, props.tickParams!, props.chartType, culture));
        break;
      case XAxisTypes.DateAxis:
        ({ xScale, tickValues } = createDateXAxis(
          XAxisParams,
          props.tickParams!,
          culture,
          dateLocalizeOptions,
          timeFormatLocale,
          customDateTimeFormatter,
          props.useUTC,
        ));
        break;
      case XAxisTypes.StringAxis:
        ({ xScale, tickValues } = createStringXAxis(
          XAxisParams,
          props.tickParams!,
          props.datasetForXAxisDomain!,
          culture,
        ));
        break;
      default:
        ({ xScale, tickValues } = createNumericXAxis(XAxisParams, props.tickParams!, props.chartType, culture));
    }
    _xScale = xScale;
    _tickValues = tickValues;

    /*
     * To enable wrapping of x axis tick values or to display complete x axis tick values,
     * we need to calculate how much space it needed to render the text.
     * No need to re-calculate every time the chart renders and same time need to get an update. So using set
     * Required space will be calculated first time chart rendering and if any width/height of chart updated.
     * */
    if (props.wrapXAxisLables || props.showXAxisLablesTooltip) {
      const wrapLabelProps = {
        node: xAxisElement.current!,
        xAxis: xScale,
        showXAxisLablesTooltip: props.showXAxisLablesTooltip || false,
        noOfCharsToTruncate: props.noOfCharsToTruncate || 4,
      };
      const temp = xScale && (createWrapOfXLabels(wrapLabelProps) as number);
      // this value need to be updated for draw graph updated. So instead of using private value, using set
      if (isRemoveValCalculated && removalValueForTextTuncate !== temp) {
        setRemovalValueForTextTuncate(temp);
        setIsRemoveValCalculated(false);
      }
    }
    /**
     * These scales used for 2 purposes.
     * 1. To create x and y axis
     * 2. To draw the graph.
     * For area/line chart using same scales. For other charts, creating their own scales to draw the graph.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let yScalePrimary: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let yScaleSecondary: any;
    const axisData: IAxisData = { yAxisDomainValues: [] };
    if (props.yAxisType && props.yAxisType === YAxisType.StringAxis) {
      yScalePrimary = createStringYAxis(
        YAxisParams,
        props.stringDatasetForYAxisDomain!,
        _useRtl,
        props.chartType,
        props.barwidth,
        culture,
      );
    } else {
      // TODO: Since the scale domain values are now computed independently for both the primary and
      // secondary y-axes, the yMinValue and yMaxValue props are no longer necessary for accurately
      // rendering the secondary y-axis. Therefore, rather than checking the secondaryYScaleOptions
      // prop to determine whether to create a secondary y-axis, it's more appropriate to check if any
      // data points are assigned to use the secondary y-scale.
      if (props?.secondaryYScaleOptions) {
        const YAxisParamsSecondary = {
          margins: margins,
          containerWidth: containerWidth,
          containerHeight: containerHeight - removalValueForTextTuncate!,
          yAxisElement: yAxisElementSecondary.current,
          yAxisTickFormat: props.yAxisTickFormat!,
          yAxisTickCount: props.yAxisTickCount!,
          yMinValue: props.secondaryYScaleOptions?.yMinValue || 0,
          yMaxValue: props.secondaryYScaleOptions?.yMaxValue ?? 100,
          tickPadding: 10,
          yMinMaxValues: props.getMinMaxOfYAxis
            ? props.getMinMaxOfYAxis(points, props.yAxisType, true)
            : getMinMaxOfYAxis(points, props.chartType, props.yAxisType, true),
          yAxisPadding: props.yAxisPadding,
        };

        yScaleSecondary = createYAxis(
          YAxisParamsSecondary,
          _useRtl,
          axisData,
          chartType,
          props.barwidth!,
          isIntegralDataset,
          true,
          props.roundedTicks!,
        );
      }
      yScalePrimary = createYAxis(
        YAxisParams,
        _useRtl,
        axisData,
        chartType,
        props.barwidth!,
        isIntegralDataset,
        false,
        props.roundedTicks!,
      );
    }

    if (chartTypesToCheck.includes(props.chartType)) {
      // To create y axis tick values by if specified truncating the rest of the text
      // and showing elipsis or showing the whole string,
      yScalePrimary &&
        createYAxisLabels(
          yAxisElement.current!,
          yScalePrimary,
          props.noOfCharsToTruncate || 4,
          props.showYAxisLablesTooltip || false,
          0,
          _useRtl,
        );

      // Removing un wanted tooltip div from DOM, when prop not provided, for proper cleanup
      // of unwanted DOM elements, to prevent flacky behaviour in tooltips , that might occur
      // in creating tooltips when tooltips are enabled( as we try to recreate a tspan with _tooltipId)
      if (!props.showYAxisLablesTooltip) {
        try {
          document.getElementById(_tooltipId) && document.getElementById(_tooltipId)!.remove();
          //eslint-disable-next-line no-empty
        } catch (e) {}
      }
      // Used to display tooltip at y axis labels.
      if (props.showYAxisLablesTooltip) {
        const _yAxisElement = d3Select(yAxisElement.current!).call(yScalePrimary);
        try {
          document.getElementById(_tooltipId) && document.getElementById(_tooltipId)!.remove();
          //eslint-disable-next-line no-empty
        } catch (e) {}
        const ytooltipProps = {
          tooltipCls: classes.tooltip!,
          id: _tooltipId,
          axis: _yAxisElement,
        };
        _yAxisElement && tooltipOfAxislabels(ytooltipProps);
      }
    }

    // Call back to the chart.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _getData = (xScale: any, yScalePrimary: any, yScaleSecondary: any) => {
      props.getGraphData &&
        props.getGraphData(
          xScale,
          yScalePrimary,
          containerHeight - removalValueForTextTuncate!,
          containerWidth,
          xAxisElement.current,
          yAxisElement.current,
          yScaleSecondary,
        );
    };

    props.getAxisData && props.getAxisData(axisData);
    // Callback function for chart, returns axis
    _getData(xScale, yScalePrimary, yScaleSecondary);

    children = props.children({
      xScale,
      yScalePrimary,
      yScaleSecondary,
      containerHeight,
      containerWidth,
    });

    if (!props.hideTooltip && calloutProps!.isPopoverOpen) {
      callout = _generateCallout(calloutProps);
    }
  }
  const svgDimensions = {
    width: containerWidth,
    height: containerHeight,
  };

  const xAxisTitleMaximumAllowedWidth = svgDimensions.width - margins.left! - margins.right! - startFromX!;
  const yAxisTitleMaximumAllowedHeight =
    svgDimensions.height - margins.bottom! - margins.top! - removalValueForTextTuncate! - titleMargin;
  /**
   * When screen resizes, along with screen, chart also auto adjusted.
   * This method used to adjust height and width of the charts.
   */
  function _fitParentContainer(): void {
    //_reqID = requestAnimationFrame(() => {
    let legendContainerHeight;
    if (props.hideLegend) {
      // If there is no legend, need not to allocate some space from total chart space.
      legendContainerHeight = 0;
    } else {
      const legendContainerComputedStyles = legendContainer && getComputedStyle(legendContainer);
      legendContainerHeight =
        ((legendContainer && legendContainer.getBoundingClientRect().height) || minLegendContainerHeight) +
        parseFloat((legendContainerComputedStyles && legendContainerComputedStyles.marginTop) || '0') +
        parseFloat((legendContainerComputedStyles && legendContainerComputedStyles.marginBottom) || '0');
    }
    if (props.parentRef || chartContainer.current) {
      const container = props.parentRef ? props.parentRef : chartContainer.current!;
      const currentContainerWidth =
        props.reflowProps?.mode === 'min-width' && !_isFirstRender.current
          ? Math.max(container.getBoundingClientRect().width, _calculateChartMinWidth())
          : container.getBoundingClientRect().width;
      const currentContainerHeight =
        container.getBoundingClientRect().height > legendContainerHeight
          ? container.getBoundingClientRect().height
          : 350;
      const shouldResize =
        containerWidth !== currentContainerWidth || containerHeight !== currentContainerHeight - legendContainerHeight;
      if (shouldResize) {
        setContainerWidth(currentContainerWidth);
        setContainerHeight(currentContainerHeight - legendContainerHeight);
      }
    }
    //});
  }

  function _onChartLeave(): void {
    props.onChartMouseLeave && props.onChartMouseLeave();
  }

  function _calculateChartMinWidth(): number {
    let labelWidth = 10; // Total padding on the left and right sides of the label

    // Case: rotated labels
    if (!props.wrapXAxisLables && props.rotateXAxisLables && props.xAxisType! === XAxisTypes.StringAxis) {
      const longestLabelWidth = calculateLongestLabelWidth(_tickValues, `.${classes.xAxis} text`);
      labelWidth += Math.ceil(longestLabelWidth * Math.cos(Math.PI / 4));
    }
    // Case: truncated labels
    else if (props.showXAxisLablesTooltip) {
      const tickValues = _tickValues.map(val => {
        const numChars = props.noOfCharsToTruncate || 4;
        return val.toString().length > numChars ? `${val.toString().slice(0, numChars)}...` : val;
      });

      const longestLabelWidth = calculateLongestLabelWidth(tickValues, `.${classes.xAxis} text`);
      labelWidth += Math.ceil(longestLabelWidth);
    }
    // Case: wrapped labels
    else if (props.wrapXAxisLables) {
      const words: string[] = [];
      _tickValues.forEach((val: string) => {
        words.push(...val.toString().split(/\s+/));
      });

      const longestLabelWidth = calculateLongestLabelWidth(words, `.${classes.xAxis} text`);
      labelWidth += Math.max(Math.ceil(longestLabelWidth), 10);
    }
    // Default case
    else {
      const longestLabelWidth = calculateLongestLabelWidth(_tickValues, `.${classes.xAxis} text`);
      labelWidth += Math.ceil(longestLabelWidth);
    }

    let minChartWidth = margins.left! + margins.right! + labelWidth * (_tickValues.length - 1);

    if (
      [ChartTypes.GroupedVerticalBarChart, ChartTypes.VerticalBarChart, ChartTypes.VerticalStackedBarChart].includes(
        props.chartType,
      )
    ) {
      const minDomainMargin = 8;
      minChartWidth += minDomainMargin * 2;
    }

    return minChartWidth;
  }

  /**
   * We have use the {@link defaultTabbableElement } to fix
   * the Focus not landing on chart while tabbing, instead  goes to legend.
   * This issue is observed in Area, line chart after performance optimization done in the PR {@link https://github.com/microsoft/fluentui/pull/27721 }
   * This issue is observed in Bar charts after the changes done by FocusZone team in the PR: {@link https://github.com/microsoft/fluentui/pull/24175 }
   * The issue in Bar Charts(VB and VSB) is due to a {@link FocusZone } update where previously an event listener was
   * attached on keydown to the window, so that whenever the tab key is pressed all outer FocusZone's
   * tab-indexes are updated (an outer FocusZone is a FocusZone that is not within another one).
   * But now after the above PR : they are attaching the
   * listeners to the FocusZone elements instead of the window. So in the first render cycle in Bar charts
   * bars are not created as in the first render cycle the size of the chart container is not known( or is 0)
   * which creates bars of height 0 so instead we do not create any bars  and instead return empty fragments.
   *
   * We have tried 2 Approaches to fix the issue:
   * 1. Using the {@link elementRef} property of FocusZone where we dispatch event for tab keydown
   *    after the second render cycle which triggers an update of the tab index in FocusZone.
   *    But this is a hacky solution and not a proper fix and also elementRef is deprecated.
   * 2. Using the default tabbable element to fix the issue.
   */

  return (
    <div
      id={idForGraph}
      className={classes.root}
      role={'presentation'}
      ref={(rootElem: HTMLDivElement) => (chartContainer.current = rootElem)}
      onMouseLeave={_onChartLeave}
    >
      <div className={classes.chartWrapper} {...focusAttributes} {...arrowAttributes}>
        {_isFirstRender.current}
        <svg
          width={svgDimensions.width}
          height={svgDimensions.height}
          aria-label={props.chartTitle}
          style={{ display: 'block' }}
          {...svgProps}
        >
          <g
            ref={(e: SVGSVGElement | null) => {
              xAxisElement.current = e!;
            }}
            id={`xAxisGElement${idForGraph}`}
            // To add wrap of x axis lables feature, need to remove word height from svg height.
            transform={`translate(0, ${svgDimensions.height - margins.bottom! - removalValueForTextTuncate!})`}
            className={classes.xAxis}
          />
          {props.xAxisTitle !== undefined && props.xAxisTitle !== '' && (
            <SVGTooltipText
              content={props.xAxisTitle}
              textProps={{
                x: margins.left! + startFromX + xAxisTitleMaximumAllowedWidth / 2,
                y: svgDimensions.height - titleMargin,
                className: classes.axisTitle!,
                textAnchor: 'middle',
              }}
              maxWidth={xAxisTitleMaximumAllowedWidth}
              wrapContent={wrapContent}
              showBackground={true}
              className={classes.svgTooltip}
            />
          )}
          <g
            ref={(e: SVGSVGElement | null) => {
              yAxisElement.current = e!;
            }}
            id={`yAxisGElement${idForGraph}`}
            transform={`translate(${
              _useRtl ? svgDimensions.width - margins.right! - startFromX : margins.left! + startFromX
            }, 0)`}
            className={classes.yAxis}
          />
          {props.secondaryYScaleOptions && (
            <g>
              <g
                ref={(e: SVGSVGElement | null) => {
                  yAxisElementSecondary.current = e!;
                }}
                id={`yAxisGElementSecondary${idForGraph}`}
                transform={`translate(${
                  _useRtl ? margins.left! + startFromX : svgDimensions.width - margins.right! - startFromX
                }, 0)`}
                className={classes.yAxis}
              />
              {props.secondaryYAxistitle !== undefined && props.secondaryYAxistitle !== '' && (
                <SVGTooltipText
                  content={props.secondaryYAxistitle}
                  textProps={{
                    x: (yAxisTitleMaximumAllowedHeight - margins.bottom!) / 2 + removalValueForTextTuncate!,
                    y: _useRtl ? startFromX - titleMargin : svgDimensions.width - margins.right!,
                    textAnchor: 'middle',
                    transform: `translate(${
                      _useRtl ? margins.right! / 2 - titleMargin : margins.right! / 2 + titleMargin
                    },
                 ${svgDimensions.height - margins.bottom! - margins.top! - titleMargin})rotate(-90)`,
                    className: classes.axisTitle!,
                  }}
                  maxWidth={yAxisTitleMaximumAllowedHeight}
                  wrapContent={wrapContent}
                  showBackground={true}
                  className={classes.svgTooltip}
                />
              )}
            </g>
          )}
          {children}
          {props.yAxisTitle !== undefined && props.yAxisTitle !== '' && (
            <SVGTooltipText
              content={props.yAxisTitle}
              textProps={{
                x: (yAxisTitleMaximumAllowedHeight - margins.bottom!) / 2 + removalValueForTextTuncate!,
                y: _useRtl ? svgDimensions.width - margins.right! / 2 + titleMargin : margins.left! / 2 - titleMargin,
                textAnchor: 'middle',
                transform: `translate(0,
                 ${svgDimensions.height - margins.bottom! - margins.top! - titleMargin})rotate(-90)`,
                className: classes.axisTitle!,
              }}
              maxWidth={yAxisTitleMaximumAllowedHeight}
              wrapContent={wrapContent}
              showBackground={true}
              className={classes.svgTooltip}
            />
          )}
        </svg>
      </div>

      {!props.hideLegend && (
        <div ref={(e: HTMLDivElement) => (legendContainer = e)} className={classes.legendContainer}>
          {props.legendBars}
        </div>
      )}
      {/** The callout is used for narration, so keep it mounted on the DOM */}
      {callout && <React.Suspense fallback={<div>Loading...</div>}>{callout}</React.Suspense>}
    </div>
  );
});
CartesianChart.displayName = 'CartesianChart';
CartesianChart.defaultProps = {
  hideTickOverlap: true,
};
