import { createContext, useContext } from 'react';

export const TrainingContext = createContext(null);
export function useTraining() {
  const value = useContext(TrainingContext);
  if (!value) throw Error('TrainingProvider is required for this component.');
  return value;
}
