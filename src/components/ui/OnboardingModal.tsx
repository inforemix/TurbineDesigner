import { useEffect, useState } from 'react'
import { Button } from './button'
import { X } from 'lucide-react'

const ONBOARDING_DISMISSED_KEY = 'turbine-designer-onboarding-dismissed'

export default function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const isDismissed = localStorage.getItem(ONBOARDING_DISMISSED_KEY)
    if (!isDismissed) {
      setIsOpen(true)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true')
    setIsOpen(false)
  }

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      dismiss()
    }
  }

  const steps = [
    {
      title: '🌀 Welcome to TurbineDesigner v1',
      description: 'An interactive tool for designing and simulating vertical-axis wind turbines (VAWTs)',
      tips: [
        'Create custom blade geometries',
        'Experiment with twist, taper, and thickness',
        'See real-time aerodynamic calculations',
      ],
    },
    {
      title: '🎨 Three Design Modes',
      description: 'Switch between modes using the buttons in the toolbar',
      tips: [
        'Draw: Edit blade curves and airfoil profiles',
        'Side: View 2D cross-section and airfoil shape',
        '3D: Visualize the turbine and spin it in the wind',
      ],
    },
    {
      title: '⚙️ Design Your Turbine',
      description: 'In Draw mode, adjust parameters to shape your turbine',
      tips: [
        'Blade points: Define the blade profile curve',
        'Height: Rotor diameter and position',
        'Twist & Taper: Advanced blade shaping',
        'Thickness: Profile depth and airfoil selection',
      ],
    },
    {
      title: '📊 Physics Simulation',
      description: 'See real-time aerodynamic performance in 3D mode',
      tips: [
        'Wind speed slider to test different conditions',
        'Power, torque, and efficiency calculations',
        'Tip-speed-ratio (TSR) optimization',
        'Save and load your designs anytime',
      ],
    },
  ]

  if (!isOpen) return null

  const step = steps[currentStep]
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-full max-w-md mx-4 bg-card rounded-2xl border border-border shadow-2xl">
        {/* Header */}
        <div className="px-6 py-6 border-b border-border">
          <div className="flex items-start justify-between gap-4 mb-4">
            <h2 className="text-xl font-bold text-foreground">{step.title}</h2>
            <button
              onClick={dismiss}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Close onboarding"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">{step.description}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="space-y-3">
            {step.tips.map((tip, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-teal/20 text-teal text-xs flex items-center justify-center font-semibold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-foreground leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-4 border-t border-border">
          <div className="w-full h-1 bg-secondary rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-teal transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground text-center mb-4">
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>

        {/* Buttons */}
        <div className="px-6 py-4 flex gap-3">
          <Button
            variant="outline"
            onClick={dismiss}
            className="flex-1 border-border hover:bg-secondary"
          >
            Skip
          </Button>
          <Button
            onClick={nextStep}
            className="flex-1 bg-teal hover:bg-teal/90 text-foreground font-semibold"
          >
            {currentStep < steps.length - 1 ? 'Next' : 'Get Started'}
          </Button>
        </div>
      </div>
    </div>
  )
}
