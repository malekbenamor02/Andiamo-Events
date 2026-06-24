import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { motion, useAnimation, useReducedMotion } from 'framer-motion';

type PassPurchaseWizardPanelProps = {
  step: number;
  children: ReactNode;
};

export function PassPurchaseWizardPanel({ children }: PassPurchaseWizardPanelProps) {
  return <>{children}</>;
}

type PassPurchaseWizardStepProps = {
  step: number;
  /** Highest step the user has reached — panels up to this stay mounted so inputs are preserved. */
  maxMountedStep: number;
  children: ReactNode;
};

function WizardPanel({
  stepNumber,
  activeStep,
  direction,
  reducedMotion,
  children,
}: {
  stepNumber: number;
  activeStep: number;
  direction: number;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const isActive = stepNumber === activeStep;
  const controls = useAnimation();

  useEffect(() => {
    if (!isActive || reducedMotion) return;
    const enterX = direction >= 0 ? 14 : -14;
    controls.set({ opacity: 0, x: enterX });
    void controls.start({
      opacity: 1,
      x: 0,
      transition: { duration: 0.26, ease: [0.25, 0.1, 0.25, 1] },
    });
  }, [isActive, direction, controls, reducedMotion]);

  return (
    <div
      className={isActive ? undefined : 'hidden'}
      aria-hidden={!isActive}
      {...(!isActive ? { inert: true } : {})}
    >
      {reducedMotion ? (
        children
      ) : (
        <motion.div animate={controls} initial={false}>
          {children}
        </motion.div>
      )}
    </div>
  );
}

export function PassPurchaseWizardStep({
  step: activeStep,
  maxMountedStep,
  children,
}: PassPurchaseWizardStepProps) {
  const reducedMotion = useReducedMotion();
  const previousStepRef = useRef(activeStep);
  const directionRef = useRef(0);

  if (activeStep !== previousStepRef.current) {
    directionRef.current = activeStep > previousStepRef.current ? 1 : -1;
    previousStepRef.current = activeStep;
  }

  const direction = directionRef.current;

  const panels = Children.toArray(children).filter(
    (child): child is ReactElement<PassPurchaseWizardPanelProps> =>
      isValidElement(child) && typeof child.props.step === 'number'
  );

  return (
    <div className="overflow-x-hidden">
      {panels.map((panel) => {
        const stepNumber = panel.props.step;
        if (stepNumber > maxMountedStep) return null;

        return (
          <WizardPanel
            key={stepNumber}
            stepNumber={stepNumber}
            activeStep={activeStep}
            direction={direction}
            reducedMotion={!!reducedMotion}
          >
            {panel.props.children}
          </WizardPanel>
        );
      })}
    </div>
  );
}
