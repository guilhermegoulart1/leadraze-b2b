// frontend/src/components/aiemployees/WorkflowBuilder/edges/DeletableEdge.jsx
// Custom edge with delete button on hover

import React, { useState } from 'react';
import {
  getBezierPath,
  getSmoothStepPath,
  EdgeLabelRenderer,
  BaseEdge
} from 'reactflow';
import { X } from 'lucide-react';

const DeletableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Use smooth step path for horizontal flow
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16
  });

  const onEdgeClick = (evt) => {
    evt.stopPropagation();
    if (data?.onDelete) {
      data.onDelete(id);
    }
  };

  return (
    <>
      {/* Invisible wider path for easier hover detection */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Visible edge */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: isHovered || selected ? 3 : 2,
          stroke: isHovered ? '#ef4444' : selected ? '#8b5cf6' : style.stroke || '#8b5cf6',
          transition: 'stroke 0.2s, stroke-width 0.2s'
        }}
      />

      {/* Delete button at edge center */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all'
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Edge label if exists */}
          {data?.label && (
            <div
              className={`
                px-2 py-0.5 text-xs font-medium rounded-full mb-1
                ${isHovered
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}
                transition-colors
              `}
            >
              {data.label}
            </div>
          )}

          {/* Delete button */}
          <button
            onClick={onEdgeClick}
            className={`
              flex items-center justify-center w-6 h-6 rounded-full
              bg-white dark:bg-gray-800 border-2 shadow-md
              transition-all duration-200 ease-out
              ${isHovered || selected
                ? 'opacity-100 scale-100 border-red-400 hover:bg-red-50 dark:hover:bg-red-900/30'
                : 'opacity-0 scale-75 border-gray-300 dark:border-gray-600'}
            `}
            title="Remover conexao"
          >
            <X className={`w-3.5 h-3.5 ${isHovered ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default DeletableEdge;
