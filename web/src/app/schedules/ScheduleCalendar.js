import React from 'react'
import { PropTypes as p } from 'prop-types'
import Card from '@material-ui/core/Card'
import Typography from '@material-ui/core/Typography'
import withStyles from '@material-ui/core/styles/withStyles'
import { connect } from 'react-redux'
import { Calendar } from 'react-big-calendar'
import '../../node_modules/react-big-calendar/lib/css/react-big-calendar.css'
import CalendarEventWrapper from './CalendarEventWrapper'
import CalendarToolbar from './CalendarToolbar'
import ScheduleOverrideCreateDialog from './ScheduleOverrideCreateDialog'
import { resetURLParams, setURLParam } from '../actions'
import { urlParamSelector } from '../selectors'
import { DateTime, Interval } from 'luxon'
import { theme } from '../mui'
import { getStartOfWeek, getEndOfWeek } from '../util/luxon-helpers'
import LuxonLocalizer from '../util/LuxonLocalizer'

const localizer = LuxonLocalizer(DateTime, { firstDayOfWeek: 0 })

const styles = {
  calendarContainer: {
    padding: '1em',
  },
}

const mapStateToProps = (state) => {
  // false: monthly, true: weekly
  const weekly = urlParamSelector(state)('weekly', false)
  const start = urlParamSelector(state)(
    'start',
    weekly
      ? getStartOfWeek().toUTC().toISO()
      : DateTime.local().startOf('month').toUTC().toISO(),
  )

  const timeUnit = weekly ? { weeks: 1 } : { months: 1 }

  const end = DateTime.fromISO(start).toLocal().plus(timeUnit).toUTC().toISO()

  return {
    start,
    end,
    weekly,
    activeOnly: urlParamSelector(state)('activeOnly', false),
    userFilter: urlParamSelector(state)('userFilter', []),
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    setWeekly: (value) => dispatch(setURLParam('weekly', value)),
    setStart: (value) => dispatch(setURLParam('start', value)),
    resetFilter: () =>
      dispatch(
        resetURLParams('userFilter', 'start', 'activeOnly', 'tz', 'weekly'),
      ),
  }
}

@withStyles(styles)
@connect(mapStateToProps, mapDispatchToProps)
export default class ScheduleCalendar extends React.PureComponent {
  static propTypes = {
    scheduleID: p.string.isRequired,
    shifts: p.array.isRequired,
  }

  state = {
    /*
     * overrideDialog should be either an object of
     * the dialog properties to use, or null to close
     * the dialog.
     */
    overrideDialog: null,
  }

  /*
   * Offsets the calendar forward or backwards
   * a week or month, depending on the current
   * view type.
   */
  handleCalNavigate = (nextDate) => {
    if (this.props.weekly) {
      this.props.setStart(
        getStartOfWeek(DateTime.fromJSDate(nextDate)).toUTC().toISO(),
      )
    } else {
      this.props.setStart(
        DateTime.fromJSDate(nextDate)
          .toLocal()
          .startOf('month')
          .toUTC()
          .toISO(),
      )
    }
  }

  /*
   * Resets the start date to the beginning of the month
   * when switching views.
   *
   * e.g. Monthly: February -> Weekly: Start at the week
   * of February 1st
   *
   * e.g. Weekly: February 17-23 -> Monthly: Start at the
   * beginning of February
   *
   * If viewing the current month however, show the current
   * week.
   */
  handleViewChange = (nextView) => {
    const start = this.props.start
    const prevStartMonth = DateTime.fromISO(start).toLocal().month
    const currMonth = DateTime.local().month

    // if viewing the current month, show the current week
    if (nextView === 'week' && prevStartMonth === currMonth) {
      this.props.setWeekly(true)
      this.props.setStart(getStartOfWeek().toUTC().toISO())

      // if not on the current month, show the first week of the month
    } else if (nextView === 'week' && prevStartMonth !== currMonth) {
      this.props.setWeekly(true)
      this.props.setStart(
        DateTime.fromISO(this.props.start)
          .toLocal()
          .startOf('month')
          .toUTC()
          .toISO(),
      )

      // go from week to monthly view
      // e.g. if navigating to an overlap of two months such as
      // Jan 27 - Feb 2, show the latter month (February)
    } else {
      this.props.setWeekly(false)

      this.props.setStart(
        getEndOfWeek(DateTime.fromJSDate(new Date(start)))
          .toLocal()
          .startOf('month')
          .toUTC()
          .toISO(),
      )
    }
  }

  /*
   * Return a GoAlert dog red color for the events, and a slightly
   * darker version of that red if selected
   */
  eventStyleGetter = (event, start, end, isSelected) => {
    return {
      style: {
        backgroundColor: isSelected ? '#8f1022' : '#cd1831',
        borderColor: '#8f1022',
      },
    }
  }

  /*
   * Return a light red shade of the current date instead of
   * the default light blue
   */
  dayPropGetter = (date) => {
    if (DateTime.fromJSDate(date).toLocal().hasSame(DateTime.local(), 'day')) {
      return {
        style: {
          backgroundColor: '#FFECEC',
        },
      }
    }
  }

  render() {
    const { classes, shifts, start, weekly } = this.props

    return (
      <React.Fragment>
        <Typography variant='caption' color='textSecondary'>
          <i>
            Times shown are in{' '}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </i>
        </Typography>
        <Card>
          <div data-cy='calendar' className={classes.calendarContainer}>
            <Calendar
              date={new Date(start)}
              localizer={localizer}
              events={this.getCalEvents(shifts)}
              style={{
                height: weekly ? '100%' : '45rem',
                fontFamily: theme.typography.body2.fontFamily,
                fontSize: theme.typography.body2.fontSize,
              }}
              tooltipAccessor={() => null}
              views={['month', 'week']}
              view={weekly ? 'week' : 'month'}
              popup
              eventPropGetter={this.eventStyleGetter}
              dayPropGetter={this.dayPropGetter}
              onNavigate={this.handleCalNavigate}
              onView={this.handleViewChange}
              components={{
                eventWrapper: (props) => (
                  <CalendarEventWrapper
                    onOverrideClick={(overrideDialog) =>
                      this.setState({ overrideDialog })
                    }
                    {...props}
                  />
                ),
                toolbar: (props) => (
                  <CalendarToolbar
                    onOverrideClick={() =>
                      this.setState({ overrideDialog: { variant: 'add' } })
                    }
                    {...props}
                  />
                ),
              }}
            />
          </div>
        </Card>
        {Boolean(this.state.overrideDialog) && (
          <ScheduleOverrideCreateDialog
            defaultValue={this.state.overrideDialog.defaultValue}
            variant={this.state.overrideDialog.variant}
            scheduleID={this.props.scheduleID}
            onClose={() => this.setState({ overrideDialog: null })}
            removeUserReadOnly
          />
        )}
      </React.Fragment>
    )
  }

  getCalEvents = (shifts) => {
    // if any users in users array, only show the ids present
    let filteredShifts = shifts.slice()
    if (this.props.userFilter.length > 0) {
      filteredShifts = filteredShifts.filter((shift) =>
        this.props.userFilter.includes(shift.user.id),
      )
    }

    if (this.props.activeOnly) {
      filteredShifts = filteredShifts.filter((shift) =>
        Interval.fromDateTimes(
          DateTime.fromISO(shift.start),
          DateTime.fromISO(shift.end),
        ).contains(DateTime.local()),
      )
    }

    return filteredShifts.map((shift) => {
      return {
        title: shift.user.name,
        userID: shift.user.id,
        start: new Date(shift.start),
        end: new Date(shift.end),
      }
    })
  }
}
