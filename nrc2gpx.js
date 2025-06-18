const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { create } = require('xmlbuilder2');

// Open database
const db = new sqlite3.Database('com.nike.nrc.room.database');

// Create output folder if not exists
if (!fs.existsSync('./gpx')) fs.mkdirSync('./gpx');

db.serialize(() => {
  let counter = 0;
  db.all(`SELECT DISTINCT a.as2_sa_id FROM activity a order by as2_sa_id ASC`, [], (err, activities) => {
    if (err) throw err;

    activities.forEach(({ as2_sa_id }) => {
      counter++;
      const query = `
      SELECT
        lat.as2_sa_id,
        datetime(lat.as2_rm_start_utc_ms / 1000, 'unixepoch', 'localtime') AS iso_time,
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
      JOIN
        (SELECT * FROM activity a
         JOIN activity_metric_group amg ON amg.as2_mg_activity_id = a.as2_sa_id
         JOIN activity_raw_metric arm ON arm.as2_rm_metric_group_id = amg.as2_mg_id
         WHERE amg.as2_mg_metric_type = 'elevation' AND a.as2_sa_id = ?) AS ele
        ON lat.as2_rm_start_utc_ms = ele.as2_rm_start_utc_ms
      JOIN activity_tag at2 ON (lat.as2_sa_id = at2.as2_t_activity_id and at2.as2_t_type = 'com.nike.name')
      LEFT JOIN activity_tag at3 ON (lat.as2_sa_id = at3.as2_t_activity_id and at3.as2_t_type = 'note')
      ORDER BY lat.as2_rm_start_utc_ms;
      `;

      db.all(query, [as2_sa_id, as2_sa_id, as2_sa_id], (err, rows) => {
        if (err) throw err;
        if (!rows.length) {
          console.log(`⛔ ERROR Exported GPX: ${as2_sa_id}.gpx`);
          return;
        }

        const { name, notes, iso_time } = rows[0];
        const safeName = `activity_${String(as2_sa_id).padStart(3, '0')}`;

        const gpx = create({ version: '1.0', encoding: 'UTF-8' })
          .ele('gpx', {
            creator: 'Garmin Connect',
            version: '1.1',
            xmlns: 'http://www.topografix.com/GPX/1/1',
            'xmlns:ns2': 'http://www.garmin.com/xmlschemas/GpxExtensions/v3',
            'xmlns:ns3': 'http://www.garmin.com/xmlschemas/TrackPointExtension/v1',
            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
            'xsi:schemaLocation':
              'http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/11.xsd',
          });

        // Metadata
        gpx.ele('metadata')
          .ele('link', { href: 'connect.garmin.com' })
            .ele('text').txt('Garmin Connect').up()
          .up()
          .ele('time').txt(new Date(iso_time).toISOString()).up()
        .up();

        // Track
        const trk = gpx.ele('trk');
        trk.ele('name').txt(`NRC ${name} - id ${as2_sa_id}` || `Activity ${as2_sa_id}`).up();
        trk.ele('desc').txt(notes || '').up();
        trk.ele('type').txt('street_running').up();

        const trkseg = trk.ele('trkseg');
        rows.forEach(r => {
          trkseg.ele('trkpt', { lat: r.latitude, lon: r.longitude })
            .ele('ele').txt(r.elevation).up()
            .ele('time').txt(new Date(r.iso_time).toISOString()).up()
            .ele('extensions')
              .ele('ns3:TrackPointExtension').up()
            .up()
          .up();
        });

        const xml = gpx.end({ prettyPrint: true });
        fs.writeFileSync(`./gpx/${safeName}.gpx`, xml);
        console.log(`✅ Exported GPX: ${safeName}.gpx`);
      });
    });
  });
});
