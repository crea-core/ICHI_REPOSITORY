
interface TaskConnectorProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

const TaskConnector = ({ fromX, fromY, toX, toY }: TaskConnectorProps) => {
  // Calculate arrow direction and connection points
  const deltaX = toX - fromX;
  const deltaY = toY - fromY;
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  
  // Calculate connection points on the edges of the nodes
  const nodeWidth = 112; // w-56 = 224px, so radius is 112px
  const nodeHeight = 80; // approximate height of task node
  
  // Calculate unit vector
  const unitX = deltaX / distance;
  const unitY = deltaY / distance;
  
  // Calculate start and end points on node edges
  const startX = fromX + (unitX * nodeWidth / 2);
  const startY = fromY + (unitY * nodeHeight / 2);
  const endX = toX - (unitX * nodeWidth / 2);
  const endY = toY - (unitY * nodeHeight / 2);
  
  // Create smooth bezier curve path for thread-like appearance
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  
  // Add natural curve like a hanging thread
  const controlOffset = Math.min(60, distance / 3);
  const controlX1 = startX + (unitY * controlOffset * 0.5);
  const controlY1 = startY - (unitX * controlOffset * 0.5) + controlOffset * 0.3;
  const controlX2 = endX + (unitY * controlOffset * 0.5);
  const controlY2 = endY - (unitX * controlOffset * 0.5) + controlOffset * 0.3;
  
  const path = `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;
  
  return (
    <svg 
      className="absolute top-0 left-0 w-full h-full pointer-events-none" 
      style={{ zIndex: 0 }}
    >
      {/* Thread-like connection line with gradient */}
      <defs>
        <linearGradient id="threadGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" className="text-green-400 dark:text-green-300" stopColor="currentColor" stopOpacity="0.8" />
          <stop offset="50%" className="text-green-500 dark:text-green-400" stopColor="currentColor" stopOpacity="0.9" />
          <stop offset="100%" className="text-green-600 dark:text-green-500" stopColor="currentColor" stopOpacity="0.8" />
        </linearGradient>
        <filter id="threadShadow">
          <feDropShadow dx="1" dy="1" stdDeviation="1" floodOpacity="0.3"/>
        </filter>
        <marker
          id="arrowhead"
          markerWidth="8"
          markerHeight="6"
          refX="7"
          refY="3"
          orient="auto"
          className="fill-green-600 dark:fill-green-400"
        >
          <polygon points="0 0, 8 3, 0 6" />
        </marker>
      </defs>
      
      <path 
        d={path} 
        stroke="url(#threadGradient)"
        strokeWidth="2.5" 
        fill="none" 
        strokeLinecap="round"
        filter="url(#threadShadow)"
        markerEnd="url(#arrowhead)"
        className="opacity-75 hover:opacity-100 transition-opacity"
      />
      
      {/* Connection point indicators with thread ends */}
      <circle 
        cx={startX} 
        cy={startY} 
        r="4" 
        className="fill-green-500 dark:fill-green-400 opacity-80 drop-shadow-sm" 
      />
      <circle 
        cx={endX} 
        cy={endY} 
        r="3" 
        className="fill-green-600 dark:fill-green-300 opacity-90 drop-shadow-sm" 
      />
    </svg>
  );
};

export default TaskConnector;
