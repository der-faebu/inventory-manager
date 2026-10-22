(function (global) {
  'use strict';

  var Schema = global.Schema;
  var XLSX = global.XLSX;

  var SHEET_NAMES = {
    overview: 'Overview',
    tree: 'Tree',
    devices: 'Devices',
    users: 'Users',
    network: 'Network',
    applications: 'Applications',
    licenses: 'Licenses',
    monitors: 'Monitors',
    locations: 'Locations',
    mailboxes: 'Mailboxes',
    ports: 'Ports',
  };

  var SHEET_GUIDE = [
    ['Tree', 'Everything as a tree, like in the app. Collapse/expand with the outline +/- controls.'],
    ['Devices', 'Each device with its users, applications, licenses, monitors, and switch port.'],
    ['Users', 'Each user with their devices and licenses.'],
    ['Network', 'Switches, routers, firewalls, access points, with port counts.'],
    ['Applications', 'Each application and which devices it is installed on.'],
    ['Licenses', 'Each license and which users/devices it is assigned to.'],
    ['Monitors', 'All monitors and which device they are connected to.'],
    ['Locations', 'Locations with address and the devices there.'],
    ['Mailboxes', 'Shared mailboxes, resources, and distribution lists.'],
    ['Ports', 'Each switch port: which device, status.'],
  ];

  function join(parts, separator) {
    return parts.filter(Boolean).join(separator || '  ·  ');
  }

  function namesOf(doc, collectionKey, ids) {
    return (ids || [])
      .map(function (id) {
        var entity = doc[collectionKey].find(function (e) {
          return e.id === id;
        });
        return entity ? Schema.entityLabel(collectionKey, entity) : null;
      })
      .filter(Boolean)
      .join(', ');
  }

  function refLabel(doc, collectionKey, id) {
    if (!id) {
      return '';
    }
    var entity = doc[collectionKey].find(function (e) {
      return e.id === id;
    });
    return entity ? Schema.entityLabel(collectionKey, entity) : '';
  }

  function relatedLabels(doc, collectionKey, predicate) {
    return doc[collectionKey]
      .filter(predicate)
      .map(function (entity) {
        return Schema.entityLabel(collectionKey, entity);
      })
      .join(', ');
  }

  function devicesOfUser(doc, userId) {
    return relatedLabels(doc, 'devices', function (device) {
      return (device.users || []).includes(userId);
    });
  }

  function devicesWithApp(doc, appId) {
    return relatedLabels(doc, 'devices', function (device) {
      return (device.apps || []).includes(appId);
    });
  }

  function usersWithLicense(doc, licenseId) {
    return relatedLabels(doc, 'users', function (user) {
      return (user.lizenzen || []).includes(licenseId);
    });
  }

  function devicesWithLicense(doc, licenseId) {
    return relatedLabels(doc, 'devices', function (device) {
      return (device.lizenzen || []).includes(licenseId);
    });
  }

  function devicesAtLocation(doc, locationId) {
    return relatedLabels(doc, 'devices', function (device) {
      return device.location === locationId;
    });
  }

  function monitorsOfDevice(doc, deviceId) {
    return doc.monitors
      .filter(function (monitor) {
        return monitor.device === deviceId;
      })
      .map(function (monitor) {
        return Schema.entityLabel('monitors', monitor);
      })
      .join(', ');
  }

  function portInfoFor(doc, networkId, port) {
    var networkPortInfo = doc.portInfo[networkId];
    return (networkPortInfo && networkPortInfo[String(port)]) || {};
  }

  function portsForNetwork(doc, networkId) {
    var devicesOnNetwork = doc.devices.filter(function (device) {
      return device.switch === networkId;
    });
    var maxPortFromDevices = devicesOnNetwork.reduce(function (max, device) {
      return Math.max(max, parseInt(device.port, 10) || 0);
    }, 0);
    var network = doc.network.find(function (n) {
      return n.id === networkId;
    });
    var portCount = Math.max(parseInt((network && network.portCount) || '0', 10) || 0, maxPortFromDevices);

    var rows = [];
    for (var p = 1; p <= portCount; p++) {
      var device = devicesOnNetwork.find(function (d) {
        return d.port === String(p);
      });
      rows.push({ port: p, device: device || null, info: portInfoFor(doc, networkId, p) });
    }
    return rows;
  }

  function portLabel(doc, device) {
    if (!device.switch) {
      return '';
    }
    return refLabel(doc, 'network', device.switch) + ' / Port ' + device.port;
  }

  function sheetFromAOA(rows) {
    return XLSX.utils.aoa_to_sheet(rows);
  }

  function setColumnWidths(sheet, widths) {
    sheet['!cols'] = widths.map(function (width) {
      return { wch: width };
    });
  }

  function setAutofilter(sheet, columnCount, rowCount) {
    var lastCol = XLSX.utils.encode_col(columnCount - 1);
    sheet['!autofilter'] = { ref: 'A1:' + lastCol + rowCount };
  }

  // --- Overview sheet ---

  function buildOverviewSheet(doc) {
    var customerName = doc.customer.name || 'Customer';
    var rows = [];
    rows.push(['Inventory – ' + customerName]);
    rows.push(['']);
    rows.push(['Customer details', '']);
    Schema.CUSTOMER_FIELDS.forEach(function (field) {
      rows.push([field.label, doc.customer[field.key] || '']);
    });
    rows.push(['']);
    rows.push(['Summary', 'Count']);
    Schema.TREE_ORDER.forEach(function (key) {
      rows.push([Schema.COLLECTIONS[key].many, doc[key].length]);
    });
    rows.push(['']);
    rows.push(['Sheet', 'What it contains']);
    SHEET_GUIDE.forEach(function (entry) {
      rows.push(entry);
    });

    var sheet = sheetFromAOA(rows);
    setColumnWidths(sheet, [36, 90]);
    return sheet;
  }

  // --- Tree sheet ---

  function buildTreeSheet(doc) {
    var rows = [['Structure', 'Details']];
    var levels = [0];

    function addRow(level, a, b) {
      rows.push([a, b || '']);
      levels.push(level);
    }

    function section(title) {
      addRow(0, title, '');
    }

    Schema.TREE_ORDER.forEach(function (collectionKey) {
      var info = Schema.COLLECTIONS[collectionKey];
      var entities = doc[collectionKey];
      section(info.many.toUpperCase() + ' (' + entities.length + ')');

      entities.forEach(function (entity) {
        var label = Schema.entityLabel(collectionKey, entity);

        if (collectionKey === 'devices') {
          var summary = join([
            entity.type,
            entity.model,
            entity.serialNumber ? 'SN ' + entity.serialNumber : '',
            refLabel(doc, 'locations', entity.location),
            entity.room,
            entity.condition,
          ]);
          addRow(1, label, summary);
          addRow(2, 'Users', namesOf(doc, 'users', entity.users));
          addRow(2, 'Applications', namesOf(doc, 'applications', entity.apps));
          addRow(2, 'Licenses', namesOf(doc, 'licenses', entity.lizenzen));
          addRow(2, 'Monitors', monitorsOfDevice(doc, entity.id));
          addRow(2, 'Network connection', join([portLabel(doc, entity), entity.ip ? 'IP ' + entity.ip : '']));
        } else if (collectionKey === 'users') {
          var usersSummary = join([entity.department, entity.role, entity.email]);
          addRow(1, label, usersSummary);
          addRow(2, 'Devices', devicesOfUser(doc, entity.id));
          addRow(2, 'Licenses', namesOf(doc, 'licenses', entity.lizenzen));
        } else if (collectionKey === 'network') {
          var networkSummary = join([entity.category, entity.model, refLabel(doc, 'locations', entity.location)]);
          addRow(1, label, networkSummary);
          var ports = portsForNetwork(doc, entity.id);
          ports.forEach(function (row) {
            var status = Schema.portStatus(row.device, row.info);
            addRow(2, 'Port ' + row.port, join([row.device ? Schema.entityLabel('devices', row.device) : '', status]));
          });
        } else if (collectionKey === 'applications') {
          addRow(1, label, join([entity.vendor, entity.licenseType]));
          addRow(2, 'Installed on', devicesWithApp(doc, entity.id));
        } else if (collectionKey === 'licenses') {
          addRow(1, label, join([entity.licenseType, entity.purchasedCount ? 'purchased ' + entity.purchasedCount : '']));
          addRow(2, 'Users', usersWithLicense(doc, entity.id));
          addRow(2, 'Devices', devicesWithLicense(doc, entity.id));
        } else if (collectionKey === 'locations') {
          addRow(1, label, entity.address);
          addRow(2, 'Devices', devicesAtLocation(doc, entity.id));
        } else if (collectionKey === 'mailboxes') {
          addRow(1, label, join([entity.type, entity.owner, entity.hosting]));
        }
      });
    });

    var sheet = sheetFromAOA(rows);
    setColumnWidths(sheet, [34, 100]);
    sheet['!rows'] = levels.map(function (level) {
      return level ? { level: level } : undefined;
    });
    sheet['!outline'] = { above: true };
    return sheet;
  }

  // --- Data sheets ---

  function buildDevicesSheet(doc) {
    var header = [
      'Name',
      'Type',
      'Manufacturer / Model',
      'Serial number',
      'Location',
      'Room',
      'Users',
      'Applications',
      'Licenses',
      'Monitors',
      'Switch / Port',
      'IP address',
      'MAC address',
      'Delivery date',
      'Warranty until',
      'Condition',
      'Remark',
    ];
    var rows = doc.devices.map(function (device) {
      return [
        Schema.entityLabel('devices', device),
        device.type,
        device.model,
        device.serialNumber,
        refLabel(doc, 'locations', device.location),
        device.room,
        namesOf(doc, 'users', device.users),
        namesOf(doc, 'applications', device.apps),
        namesOf(doc, 'licenses', device.lizenzen),
        monitorsOfDevice(doc, device.id),
        portLabel(doc, device),
        device.ip,
        device.mac,
        device.deliveryDate,
        device.warrantyUntil,
        device.condition,
        device.remark,
      ];
    });
    return buildDataSheet(header, rows, [20, 12, 24, 16, 16, 10, 24, 24, 24, 20, 18, 14, 16, 14, 14, 10, 24]);
  }

  function buildUsersSheet(doc) {
    var header = ['Name', 'Username', 'Department', 'Role', 'Email', 'Devices', 'Licenses', 'MFA', 'Admin rights', 'Remark'];
    var rows = doc.users.map(function (user) {
      return [
        Schema.entityLabel('users', user),
        user.login,
        user.department,
        user.role,
        user.email,
        devicesOfUser(doc, user.id),
        namesOf(doc, 'licenses', user.lizenzen),
        user.mfa,
        user.admin,
        user.remark,
      ];
    });
    return buildDataSheet(header, rows, [20, 16, 16, 16, 24, 24, 24, 8, 12, 24]);
  }

  function buildNetworkSheet(doc) {
    var header = [
      'Name',
      'Category',
      'Manufacturer / Model',
      'Serial number',
      'IP address',
      'MAC address',
      'Firmware',
      'Location',
      'Room / Rack',
      'Total ports',
      'Uplink to',
      'Warranty / Support until',
      'Remark',
    ];
    var rows = doc.network.map(function (network) {
      return [
        Schema.entityLabel('network', network),
        network.category,
        network.model,
        network.serialNumber,
        network.ip,
        network.mac,
        network.firmware,
        refLabel(doc, 'locations', network.location),
        network.rack,
        network.portCount,
        network.uplink,
        network.supportUntil,
        network.remark,
      ];
    });
    return buildDataSheet(header, rows, [20, 14, 24, 16, 14, 16, 12, 16, 14, 10, 16, 18, 24]);
  }

  function buildApplicationsSheet(doc) {
    var header = ['Application', 'Version', 'Vendor', 'License type', 'Business-critical', 'Installed on'];
    var rows = doc.applications.map(function (application) {
      return [
        Schema.entityLabel('applications', application),
        application.version,
        application.vendor,
        application.licenseType,
        application.businessCritical,
        devicesWithApp(doc, application.id),
      ];
    });
    return buildDataSheet(header, rows, [24, 12, 20, 16, 14, 30]);
  }

  function buildLicensesSheet(doc) {
    var header = ['License type / Product', 'License type', 'Purchased (count)', 'Users', 'Devices', 'Term / Renewal', 'Remark'];
    var rows = doc.licenses.map(function (license) {
      return [
        Schema.entityLabel('licenses', license),
        license.licenseType,
        license.purchasedCount,
        usersWithLicense(doc, license.id),
        devicesWithLicense(doc, license.id),
        license.term,
        license.remark,
      ];
    });
    return buildDataSheet(header, rows, [24, 16, 14, 24, 24, 20, 24]);
  }

  function buildMonitorsSheet(doc) {
    var header = ['Inventory no.', 'Manufacturer / Model', 'Serial number', 'Connector', 'Connected to'];
    var rows = doc.monitors.map(function (monitor) {
      return [
        Schema.entityLabel('monitors', monitor),
        monitor.model,
        monitor.serialNumber,
        monitor.connector,
        refLabel(doc, 'devices', monitor.device),
      ];
    });
    return buildDataSheet(header, rows, [16, 24, 16, 14, 20]);
  }

  function buildLocationsSheet(doc) {
    var header = ['Name', 'Address', 'Rooms', 'Contact / Phone / Email', 'Server room / Rack', 'Devices'];
    var rows = doc.locations.map(function (location) {
      return [
        Schema.entityLabel('locations', location),
        location.address,
        location.rooms,
        location.contact,
        location.serverRoom,
        devicesAtLocation(doc, location.id),
      ];
    });
    return buildDataSheet(header, rows, [20, 24, 10, 28, 20, 30]);
  }

  function buildMailboxesSheet(doc) {
    var header = ['Email address', 'Type', 'Owner', 'Hosting'];
    var rows = doc.mailboxes.map(function (mailbox) {
      return [Schema.entityLabel('mailboxes', mailbox), mailbox.type, mailbox.owner, mailbox.hosting];
    });
    return buildDataSheet(header, rows, [28, 18, 20, 12]);
  }

  function buildPortsSheet(doc) {
    var header = ['Switch', 'Port', 'Connected device', 'Status', 'Jack', 'Remark'];
    var rows = [];
    doc.network.forEach(function (network) {
      var ports = portsForNetwork(doc, network.id);
      ports.forEach(function (row) {
        var status = Schema.portStatus(row.device, row.info);
        rows.push([
          Schema.entityLabel('network', network),
          row.port,
          row.device ? Schema.entityLabel('devices', row.device) : '',
          status,
          row.info.jack || '',
          row.info.remark || '',
        ]);
      });
    });
    return buildDataSheet(header, rows, [20, 8, 20, 12, 14, 24]);
  }

  function buildDataSheet(header, rows, widths) {
    var sheet = sheetFromAOA([header].concat(rows));
    setColumnWidths(sheet, widths);
    setAutofilter(sheet, header.length, rows.length + 1);
    return sheet;
  }

  function buildWorkbook(doc) {
    var workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, buildOverviewSheet(doc), SHEET_NAMES.overview);
    XLSX.utils.book_append_sheet(workbook, buildTreeSheet(doc), SHEET_NAMES.tree);
    XLSX.utils.book_append_sheet(workbook, buildDevicesSheet(doc), SHEET_NAMES.devices);
    XLSX.utils.book_append_sheet(workbook, buildUsersSheet(doc), SHEET_NAMES.users);
    XLSX.utils.book_append_sheet(workbook, buildNetworkSheet(doc), SHEET_NAMES.network);
    XLSX.utils.book_append_sheet(workbook, buildApplicationsSheet(doc), SHEET_NAMES.applications);
    XLSX.utils.book_append_sheet(workbook, buildLicensesSheet(doc), SHEET_NAMES.licenses);
    XLSX.utils.book_append_sheet(workbook, buildMonitorsSheet(doc), SHEET_NAMES.monitors);
    XLSX.utils.book_append_sheet(workbook, buildLocationsSheet(doc), SHEET_NAMES.locations);
    XLSX.utils.book_append_sheet(workbook, buildMailboxesSheet(doc), SHEET_NAMES.mailboxes);
    XLSX.utils.book_append_sheet(workbook, buildPortsSheet(doc), SHEET_NAMES.ports);
    return workbook;
  }

  function writeBuffer(workbook) {
    // No cellStyles: v1 intentionally ships with no custom cell styling (see issue #16).
    return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  }

  global.ExcelExport = {
    buildWorkbook: buildWorkbook,
    writeBuffer: writeBuffer,
  };
})(typeof window !== 'undefined' ? window : globalThis);
