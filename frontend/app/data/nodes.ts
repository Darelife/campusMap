export interface SphereCorrection {
  pan: string;
}

export interface Link {
  nodeId: string;
}

export interface Node {
  id: string;
  panorama: string;
  caption: string;
  gps: [number, number, number];
  locations: string[];
  sphereCorrection: SphereCorrection;
  links: Link[];
}

export const nodes: Node[] = [
    {
      id: 'A11',
      panorama: '/A11.jpg',
      caption: 'B Dome Side',
      gps: [73.879439, 15.392513, 0],
      locations: ['BDome', 'AH1', 'INS'],
      sphereCorrection: { pan: '220.04deg' },
      links: [{ nodeId: 'A12' }],
    },
    {
      id: 'A12',
      panorama: '/A12.jpg',
      caption: 'B Dome Front',
      gps: [73.879949, 15.392390, 0],
      locations: ['Main Building', 'BDome', 'B Dome', 'Central'],
      sphereCorrection: { pan: '-59.69deg' },
      links: [{ nodeId: 'A13' }, { nodeId: 'A11' }],
    },
    {
      id: 'A13',
      panorama: '/A13.jpg',
      caption: 'Library Entrance',
      gps: [73.880232, 15.391779, 0],
      locations: ['Library', 'Books Section', 'Reading Hall', 'Main Building'],
      sphereCorrection: { pan: '251.69deg' },
      links: [{ nodeId: 'A14' }, { nodeId: 'A12' }],
    },
    {
      id: 'A14',
      panorama: '/A14.jpg',
      caption: 'D Spine Entrance',
      gps: [73.880465, 15.391935, 0],
      locations: ['D Spine', 'Entrance', 'Hostel Road', 'Main Corridor'],
      sphereCorrection: { pan: '280.70deg' },
      links: [{ nodeId: 'A13' }, { nodeId: 'A15' }],
    },
    {
      id: 'A15',
      panorama: '/A15.jpg',
      caption: 'D Spine Library-Bdome Intersection',
      gps: [73.880739, 15.391952, 0],
      locations: ['D Spine', 'Library', 'Bdome', 'Intersection'],
      sphereCorrection: { pan: '12.70deg' },
      links: [{ nodeId: 'A14' }, { nodeId: 'A16' }],
    },
    {
      id: 'A16',
      panorama: '/A16.jpg',
      caption: 'D Spine CC Intersection',
      gps: [73.880944, 15.391997, 0],
      locations: ['D Spine', 'CC', 'Subspot', 'Amul', 'CC Lab'],
      sphereCorrection: { pan: '349.26deg' },
      links: [{ nodeId: 'A15' }, { nodeId: 'A17' }],
    },
    {
      id: 'A17',
      panorama: '/A17.jpg',
      caption: 'D Spine Center',
      gps: [73.881381, 15.392110, 0],
      locations: ['D Spine', 'Center', 'Plant'],
      sphereCorrection: { pan: '250.36deg' },
      links: [{ nodeId: 'A16' }, { nodeId: 'A18' }],
    },
    {
      id: 'A18',
      panorama: '/A18.jpg',
      caption: 'D Spine Phoenix',
      gps: [73.881876, 15.392236, 0],
      locations: ['D Spine', 'Phoenix Dept'],
      sphereCorrection: { pan: '200.60deg' },
      links: [{ nodeId: 'A17' }, { nodeId: 'A19' }],
    },
    {
      id: 'A19',
      panorama: '/A19.jpg',
      caption: 'D Spine Snake Path',
      gps: [73.882161, 15.392325, 0],
      locations: ['D Spine', 'Snake Path'],
      sphereCorrection: { pan: '20.00deg' },
      links: [{ nodeId: 'A18' }, { nodeId: 'A20' }],
    },
    {
      id: 'A20',
      panorama: '/A20.jpg',
      caption: 'D Spine CS Dept',
      gps: [73.882419, 15.392385, 0],
      locations: ['D Spine', 'CS Dept'],
      sphereCorrection: { pan: '284.98deg' },
      links: [{ nodeId: 'A19' }, { nodeId: 'A21' }, { nodeId: 'A22' }],
    },
    {
      id: 'A21',
      panorama: '/A21.jpg',
      caption: 'D Spine Hostel Intersection',
      gps: [73.882750, 15.392481, 0],
      locations: ['D Spine', 'Hostel Intersection', 'Hostel Road'],
      sphereCorrection: { pan: '284.98deg' },
      links: [{ nodeId: 'A20' }],
    },
    {
      id: 'A22',
      panorama: '/A22.jpg',
      caption: 'CS Dept Imaginarium',
      gps: [73.882533, 15.392142, 0],
      locations: ['CS Dept', 'Imaginarium', 'DLT 7', 'DLT 8'],
      sphereCorrection: { pan: '180.14deg' },
      links: [{ nodeId: 'A20' }, { nodeId: 'A23' }],
    },
    {
      id: 'A23',
      panorama: '/A23.jpg',
      caption: 'CS Dept D151',
      gps: [73.88258659294941, 15.392057935008628, 0],
      locations: ['CS Dept', 'D151', 'Washroom', 'D 151'],
      sphereCorrection: { pan: '200.14deg' },
      links: [{ nodeId: 'A22' }, { nodeId: 'A24' }],
    },
    {
      id: 'A24',
      panorama: '/A24.jpg',
      caption: 'CS Dept D153',
      gps: [73.88263889602477, 15.391859459103431, 0],
      locations: ['CS Dept', 'D153', 'Washroom', 'D 153'],
      sphereCorrection: { pan: '210.14deg' },
      links: [{ nodeId: 'A23' }, { nodeId: 'A25' }, {nodeId: 'A40'}],
    },
    {
      id: 'A25',
      panorama: '/A25.jpg',
      caption: 'CS Dept D153',
      gps: [73.88251886717195, 15.391843943063517, 0],
      locations: ['CS Dept', 'CSIS Conference Room', 'Conference Room', 'Hemant Rathore', 'D155', 'D 155', 'D156', 'D 156'],
      sphereCorrection: { pan: '160.14deg' },
      links: [{ nodeId: 'A24' }],
    },
    {
      id: 'A34',
      panorama: '/A34.jpg',
      caption: 'CS Department 2nd floor Outer',
      gps: [73.88254, 15.39205, 0],
      locations: ['CS Dept', 'Chambers', 'Washroom',],
      sphereCorrection: { pan: '15.5deg' },
      links: [{ nodeId: 'A36' }],
    },
    {
      id: 'A35',
      panorama: '/A35.jpg',
      caption: 'CS Department 2nd floor Chambers',
      gps: [73.88233, 15.39220, 0],
      locations: ['CS Dept', 'Chambers','HOD Office' ],
      sphereCorrection: { pan: '79.05deg' },
      links: [{ nodeId: 'A36' }],
    },
    {
      id: 'A36',
      panorama: '/A36.jpg',
      caption: 'CS Department 2nd floor Chambers D Spine end',
      gps: [73.88187, 15.39189, 0],
      locations: ['CS Dept', 'Chambers', 'D Spine'],
      sphereCorrection: { pan: '79.05deg' },
      links: [{ nodeId: 'A34' },{ nodeId: 'A35' }],
    },
    {
      id: 'A40',
      panorama: '/A40.jpg',
      caption: 'NAB Open Area 1',
      gps: [73.882633, 15.391617, 0],
      locations: ['CS Dept', 'NAB', 'NAB Open Area'],
      sphereCorrection: { pan: '350.61deg' },
      links: [{ nodeId: 'A41' }, {nodeId: 'A24'}],
    },
    {
      id: 'A41',
      panorama: '/A41.jpg',
      caption: 'NAB Open Area 2',
      gps: [73.882366, 15.391580, 0],
      locations: ['CS Dept', 'NAB', 'NAB Open Area'],
      sphereCorrection: { pan: '180deg' },
      links: [{ nodeId: 'A40' }],
    }
  ]
