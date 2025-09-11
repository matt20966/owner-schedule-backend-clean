import WeekCalendar from './components/Calendar.jsx';

function App() {
  const styles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    },
    title: {
      fontSize: '36px',
      fontWeight: '700',
      color: '#1e293b',
      marginBottom: '32px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textAlign: 'center'
    },
    calendarWrapper: {
      width: '100%',
      maxWidth: '1500px',
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.calendarWrapper}>
        <WeekCalendar/>
      </div>
    </div>
  );
}

export default App;