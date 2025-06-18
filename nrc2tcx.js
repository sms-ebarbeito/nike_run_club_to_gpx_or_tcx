const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { create } = require('xmlbuilder2');

const db = new sqlite3.Database('com.nike.nrc.room.database');

if (!fs.existsSync('./tcx')) fs.mkdirSync('./tcx');

db.serialize(() => {
  db.all(`SELECT DISTINCT a.as2_sa_id FROM activity a ORDER BY as2_sa_id ASC`, [], (err, activities) => {
    if (err) throw err;

    activities.forEach(({ as2_sa_id }) => {
      const summaryQuery = `
        SELECT
          MAX(CASE WHEN as2_s_metric_type = 'distance' AND as2_s_type = 'total' THEN as2_s_value * 1000 END) AS distance,
          MAX(CASE WHEN as2_s_metric_type = 'speed' AND as2_s_type = 'max' THEN as2_s_value END) AS max_speed,
          MAX(CASE WHEN as2_s_metric_type = 'calories' AND as2_s_type = 'total' THEN as2_s_value END) AS calories
        FROM activity_summary
        WHERE as2_s_activity_id = ?
      `;

      db.get(summaryQuery, [as2_sa_id], (err, summaryData) => {
        if (err) throw err;

        const gpsQuery = `
          SELECT
            lat.as2_sa_id,
            strftime('%Y-%m-%dT%H:%M:%fZ', lat.as2_rm_start_utc_ms / 1000.0, 'unixepoch') AS iso_time,
            lat.as2_rm_value AS latitude,
            lon.as2_rm_value AS longitude,
            ele.as2_rm_value AS elevation,
            at2.as2_t_value AS name,
            at3.as2_t_value AS notes
          FROM
            (SELECT * FROM activity a
             JOIN activity_metric_group amg ON amg.as2_mg_activity_id = a.as2_sa_id
             JOIN activity_raw_metric arm ON arm.as2_rm_metric_group_id = amg.as2_mg_id
             WHERE amg.as2_mg_metric_type = 'latitude' AND a.as2_sa_id = ?) AS lat
          JOIN
            (SELECT * FROM activity a
             JOIN activity_metric_group amg ON amg.as2_mg_activity_id = a.as2_sa_id
             JOIN activity_raw_metric arm ON arm.as2_rm_metric_group_id = amg.as2_mg_id
             WHERE amg.as2_mg_metric_type = 'longitude' AND a.as2_sa_id = ?) AS lon
            ON lat.as2_rm_start_utc_ms = lon.as2_rm_start_utc_ms
          LEFT JOIN
            (SELECT * FROM activity a
             JOIN activity_metric_group amg ON amg.as2_mg_activity_id = a.as2_sa_id
             JOIN activity_raw_metric arm ON arm.as2_rm_metric_group_id = amg.as2_mg_id
             WHERE amg.as2_mg_metric_type = 'elevation' AND a.as2_sa_id = ?) AS ele
            ON lat.as2_rm_start_utc_ms = ele.as2_rm_start_utc_ms
          JOIN activity_tag at2 ON (lat.as2_sa_id = at2.as2_t_activity_id AND at2.as2_t_type = 'com.nike.name')
          LEFT JOIN activity_tag at3 ON (lat.as2_sa_id = at3.as2_t_activity_id AND at3.as2_t_type = 'note')
          ORDER BY lat.as2_rm_start_utc_ms;
        `;

        db.all(gpsQuery, [as2_sa_id, as2_sa_id, as2_sa_id], (err, rows) => {
          if (err) throw err;
          if (!rows.length) {
            console.log(`⛔ ERROR exporting TCX: ${as2_sa_id}`);
            return;
          }

          const { name, notes, iso_time } = rows[0];
          const safeName = `activity_${String(as2_sa_id).padStart(3, '0')}`;
          const startTime = new Date(rows[0].iso_time);
          const endTime = new Date(rows[rows.length - 1].iso_time);
          const totalTimeSeconds = ((endTime - startTime) / 1000).toFixed(1);

          const tcx = create({ version: '1.0', encoding: 'UTF-8' })
            .ele('TrainingCenterDatabase', {
              xmlns: 'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2',
              'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
              'xsi:schemaLocation':
                'http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd'
            });

          const activities = tcx.ele('Activities');
          const activity = activities.ele('Activity', { Sport: 'Running' });
          activity.ele('Id').txt(iso_time);
          if (notes) activity.ele('Notes').txt(notes);

          const lap = activity.ele('Lap', { StartTime: iso_time });
          lap.ele('TotalTimeSeconds').txt(totalTimeSeconds);
          lap.ele('DistanceMeters').txt(summaryData?.distance || '0');
          lap.ele('MaximumSpeed').txt(summaryData?.max_speed || '0');
          lap.ele('Calories').txt(summaryData?.calories || '0');
          lap.ele('Intensity').txt('Active');
          lap.ele('TriggerMethod').txt('Manual');

          const track = lap.ele('Track');
          rows.forEach(r => {
            const tp = track.ele('Trackpoint');
            tp.ele('Time').txt(r.iso_time);
            tp.ele('Position')
              .ele('LatitudeDegrees').txt(r.latitude).up()
              .ele('LongitudeDegrees').txt(r.longitude).up()
            .up();
            tp.ele('AltitudeMeters').txt(r.elevation);
          });

          const xml = tcx.end({ prettyPrint: true });
          fs.writeFileSync(`./tcx/${safeName}.tcx`, xml);
          console.log(`✅ Exported TCX: ${safeName}.tcx`);
        });
      });
    });
  });
});
